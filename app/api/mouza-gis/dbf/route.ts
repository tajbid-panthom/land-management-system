import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { uploadToCloudinary } from "@/lib/storage/cloudinary";
import { parseGisFile, parseLegacyShapefileUpload } from "@/lib/mouza-gis/shapefile-service";
import { insertFeaturesFromParsed } from "@/lib/mouza-gis/mapping";
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
  const datasetId = formData.get("datasetId") as string | null;
  const uploadFile =
    (formData.get("dbf") as File | null) ??
    (formData.get("zip") as File | null) ??
    (formData.get("shapefile") as File | null) ??
    (formData.get("file") as File | null);
  const shpFile = formData.get("shp") as File | null;

  if (!datasetId) {
    return NextResponse.json({ error: "datasetId is required" }, { status: 400 });
  }

  if (!uploadFile) {
    return NextResponse.json(
      { error: "Upload a .dbf file or a .zip containing shapefile/DBF data" },
      { status: 400 },
    );
  }

  const dataset = await getDatasetById(datasetId);
  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  try {
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
        { error: "Upload a .dbf or .zip file" },
        { status: 400 },
      );
    }

    if (parsed.features.length === 0) {
      return NextResponse.json(
        { error: "DBF file contains no records" },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const archiveUpload = await uploadToCloudinary(archiveBuffer, {
      folder: `mouza-gis/${dataset.slug}/archives`,
      resourceType: "raw",
      publicId: `${ext === "dbf" ? "dbf" : "shapefile"}-v${timestamp}`,
    });

    let geojsonUpload: Awaited<ReturnType<typeof uploadToCloudinary>> | null = null;
    if (parsed.hasGeometry && parsed.geojson.features.length > 0) {
      const geojsonBuffer = Buffer.from(JSON.stringify(parsed.geojson), "utf-8");
      geojsonUpload = await uploadToCloudinary(geojsonBuffer, {
        folder: `mouza-gis/${dataset.slug}/geojson`,
        resourceType: "raw",
        publicId: `geojson-v${timestamp}`,
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

    const featureCount = await insertFeaturesFromParsed(
      datasetId,
      fileRecord.id,
      parsed.features,
    );

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

    return NextResponse.json({
      file: fileRecord,
      dbfFile: fileRecord,
      featureCount,
      hasGeometry: parsed.hasGeometry,
      geojsonUrl: geojsonUpload?.secureUrl ?? null,
      matchKeys: ["M_Code + Plot_No", "Mauza_JL_S + Plot_No"],
      message: parsed.hasGeometry
        ? "Shapefile processed with geometry."
        : "DBF attributes imported. Map boundaries unavailable until a .shp is provided. Run mapping to join with Excel data.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "GIS upload failed";
    console.error("[mouza-gis/dbf]", message, err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
