import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { storeMouzaGisFile } from "@/lib/mouza-gis/storage";
import { ensureDatasetForUpload } from "@/lib/mouza-gis/dataset-service";
import { parseGisFile, parseLegacyShapefileUpload } from "@/lib/mouza-gis/shapefile-service";
import { insertFeaturesFromParsed, rebuildRecordsFromFeatures } from "@/lib/mouza-gis/mapping";
import { fixWrongUtmZoneGeometries } from "@/lib/mouza-gis/reproject";
import { synchronizeDataset } from "@/lib/mouza-gis/sync-service";
import { getDatasetById } from "@/lib/mouza-gis/queries";
import { db } from "@/lib/db";
import { mouzaDbfFiles, mouzaGisFeatures } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit/log";

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const datasetIdParam = formData.get("datasetId") as string | null;
  const uploadFile =
    (formData.get("dbf") as File | null) ??
    (formData.get("zip") as File | null) ??
    (formData.get("shapefile") as File | null) ??
    (formData.get("file") as File | null);
  const shpFile = formData.get("shp") as File | null;

  if (!uploadFile) {
    return NextResponse.json(
      { error: "Upload a .zip shapefile archive" },
      { status: 400 },
    );
  }

  try {
    const started = Date.now();
    const archiveBuffer = Buffer.from(await uploadFile.arrayBuffer());
    const archiveName = uploadFile.name;
    const ext = getExtension(archiveName);

    let parsed;

    if (ext === "dbf" || ext === "zip") {
      parsed = await parseGisFile(archiveBuffer, archiveName);
    } else if (shpFile) {
      parsed = await parseLegacyShapefileUpload({
        dbf: archiveBuffer,
        shp: Buffer.from(await shpFile.arrayBuffer()),
        fileName: uploadFile.name,
      });
    } else {
      return NextResponse.json(
        { error: "Upload a .zip shapefile archive" },
        { status: 400 },
      );
    }

    if (parsed.features.length === 0) {
      return NextResponse.json(
        { error: "Shapefile contains no records" },
        { status: 400 },
      );
    }

    console.info(
      `[mouza-gis/dbf] parsed ${parsed.features.length} features in ${Date.now() - started}ms`,
    );

    const dataset = await ensureDatasetForUpload({
      datasetId: datasetIdParam,
      fileName: archiveName,
      features: parsed.features,
    });
    const datasetId = dataset.id;
    const datasetInfo = await getDatasetById(datasetId);
    if (!datasetInfo) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const timestamp = Date.now();
    const archiveUpload = await storeMouzaGisFile(archiveBuffer, {
      datasetId,
      folder: "archives",
      fileName: archiveName,
      publicIdBase: `${ext === "dbf" ? "dbf" : "shapefile"}-v${timestamp}`,
    });

    let geojsonUpload: Awaited<ReturnType<typeof storeMouzaGisFile>> | null = null;
    if (parsed.hasGeometry && parsed.geojson.features.length > 0) {
      const geojsonBuffer = Buffer.from(JSON.stringify(parsed.geojson), "utf-8");
      geojsonUpload = await storeMouzaGisFile(geojsonBuffer, {
        datasetId,
        folder: "geojson",
        fileName: `geojson-v${timestamp}.json`,
        publicIdBase: `geojson-v${timestamp}`,
      });
    }

    const [latestVersion] = await db
      .select({ version: mouzaDbfFiles.version })
      .from(mouzaDbfFiles)
      .where(eq(mouzaDbfFiles.datasetId, datasetId))
      .orderBy(desc(mouzaDbfFiles.version))
      .limit(1);

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    await db
      .update(mouzaDbfFiles)
      .set({ isActive: false })
      .where(
        and(
          eq(mouzaDbfFiles.datasetId, datasetId),
          eq(mouzaDbfFiles.isActive, true),
        ),
      );

    await db
      .delete(mouzaGisFeatures)
      .where(eq(mouzaGisFeatures.datasetId, datasetId));

    const [fileRecord] = await db
      .insert(mouzaDbfFiles)
      .values({
        datasetId,
        fileName: archiveName,
        cloudinaryPublicId: archiveUpload.publicId,
        cloudinaryUrl: archiveUpload.secureUrl,
        geojsonCloudinaryPublicId: geojsonUpload?.publicId,
        geojsonCloudinaryUrl: geojsonUpload?.secureUrl,
        fileSizeBytes: archiveUpload.bytes,
        geojsonSizeBytes: geojsonUpload?.bytes,
        format: ext === "dbf" ? "dbf" : parsed.hasGeometry ? "zip" : "zip-dbf-only",
        version: nextVersion,
        isActive: true,
        fieldNames: parsed.fieldNames,
        recordCount: parsed.features.length,
        uploadedBy: session.user.id,
      })
      .returning();

    const sourceEpsg = parsed.sourceEpsg ?? 4326;
    const featureCount = await insertFeaturesFromParsed(
      datasetId,
      fileRecord.id,
      parsed.features,
      sourceEpsg,
    );
    console.info(
      `[mouza-gis/dbf] inserted ${featureCount} features (EPSG:${sourceEpsg}) in ${Date.now() - started}ms`,
    );

    if (parsed.hasGeometry) {
      const repaired = await fixWrongUtmZoneGeometries(datasetId);
      if (repaired.featureCount > 0 || repaired.parcelCount > 0) {
        console.info(
          `[mouza-gis/dbf] repaired UTM zone geometries: ${repaired.featureCount} features, ${repaired.parcelCount} parcels`,
        );
      }
    }

    const recordCount = await rebuildRecordsFromFeatures(datasetId);
    console.info(`[mouza-gis/dbf] rebuilt ${recordCount} records in ${Date.now() - started}ms`);

    let sync = null;
    try {
      sync = await synchronizeDataset(datasetId);
      console.info(
        `[mouza-gis/dbf] sync complete: ${sync.synced} synced, ${sync.failed} failed in ${Date.now() - started}ms`,
      );
    } catch (syncErr) {
      console.error("[mouza-gis/dbf] auto-sync failed", syncErr);
    }

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "create",
      entityTable: "mouza_dbf_files",
      entityId: fileRecord.id,
      newValue: {
        fileName: archiveName,
        version: nextVersion,
        featureCount,
        hasGeometry: parsed.hasGeometry,
        geojsonUrl: geojsonUpload?.secureUrl ?? null,
      },
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });

    const storageNote =
      archiveUpload.storage === "local"
        ? " Archive stored locally (exceeds Cloudinary 20 MB limit)."
        : "";

    return NextResponse.json({
      dataset: { id: datasetId, name: datasetInfo.name, created: dataset.created },
      file: fileRecord,
      dbfFile: fileRecord,
      featureCount,
      recordCount,
      hasGeometry: parsed.hasGeometry,
      geojsonUrl: geojsonUpload?.secureUrl ?? null,
      storage: archiveUpload.storage,
      sync,
      matchKeys: ["M_Code + Plot_No", "Mauza_JL_S + Plot_No"],
      message: parsed.hasGeometry
        ? `Shapefile uploaded: ${featureCount} plots mapped, ${recordCount} records synced to registry.${storageNote}`
        : `Shapefile uploaded without geometry. Upload a .zip with .shp, .shx, .dbf, and .prj for map boundaries.${storageNote}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "GIS upload failed";
    console.error("[mouza-gis/dbf]", message, err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
