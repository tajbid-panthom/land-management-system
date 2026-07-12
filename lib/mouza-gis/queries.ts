import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  districts,
  upazilas,
  mouzas,
  unions,
  landParcels,
  mouzaGisDatasets,
  mouzaGisRecords,
  mouzaGisFeatures,
  mouzaDbfFiles,
  mouzaGisImports,
  khatians,
  ownershipRecords,
  owners,
  deeds,
  mutationCases,
  courtCases,
  properties,
  propertyDeeds,
  propertyDocuments,
  documentCategories,
} from "@/lib/db/schema";
import type { MapBBox } from "@/lib/gis-maps/viewport";
import {
  defaultViewportFeatureLimit,
  simplifyToleranceForZoom,
} from "@/lib/gis-maps/viewport";

export async function listDatasets() {
  return db
    .select({
      id: mouzaGisDatasets.id,
      name: mouzaGisDatasets.name,
      slug: mouzaGisDatasets.slug,
      districtId: mouzaGisDatasets.districtId,
      districtName: districts.name,
      status: mouzaGisDatasets.status,
      recordCount: sql<number>`(
        SELECT COUNT(*)::int FROM mouza_gis_records
        WHERE dataset_id = ${mouzaGisDatasets.id}
      )`,
      mappedCount: sql<number>`(
        SELECT COUNT(*)::int FROM mouza_gis_records
        WHERE dataset_id = ${mouzaGisDatasets.id} AND mapped_at IS NOT NULL
      )`,
      hasDbf: sql<boolean>`EXISTS (
        SELECT 1 FROM mouza_dbf_files
        WHERE dataset_id = ${mouzaGisDatasets.id} AND is_active = true
      )`,
      createdAt: mouzaGisDatasets.createdAt,
    })
    .from(mouzaGisDatasets)
    .leftJoin(districts, eq(mouzaGisDatasets.districtId, districts.id))
    .orderBy(asc(mouzaGisDatasets.name));
}

export async function getDatasetBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(mouzaGisDatasets)
    .where(eq(mouzaGisDatasets.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getDatasetById(id: string) {
  const [row] = await db
    .select()
    .from(mouzaGisDatasets)
    .where(eq(mouzaGisDatasets.id, id))
    .limit(1);
  return row ?? null;
}

export async function listMouzasByUpazila(upazilaId: string) {
  const fromGis = await db
    .selectDistinct({
      id: mouzaGisRecords.mouzaId,
      name: mouzaGisRecords.mauza,
      jlNumber: mouzaGisRecords.jlNo,
      mCode: mouzaGisRecords.mCode,
    })
    .from(mouzaGisRecords)
    .innerJoin(mouzas, eq(mouzaGisRecords.mouzaId, mouzas.id))
    .where(
      and(
        eq(mouzas.upazilaId, upazilaId),
        sql`${mouzaGisRecords.mouzaId} IS NOT NULL`,
      ),
    )
    .orderBy(asc(mouzaGisRecords.mauza));

  if (fromGis.length > 0) {
    return fromGis.filter((m) => m.id).map((m) => ({
      id: m.id!,
      name: m.name,
      jlNumber: m.jlNumber,
      mCode: m.mCode,
    }));
  }

  return db
    .select({
      id: mouzas.id,
      name: mouzas.name,
      jlNumber: mouzas.jlNumber,
      mCode: mouzas.mCode,
    })
    .from(mouzas)
    .where(eq(mouzas.upazilaId, upazilaId))
    .orderBy(asc(mouzas.name));
}

export async function listMouzasByDistrictFromGis(districtId: string) {
  return db
    .selectDistinct({
      name: mouzaGisRecords.mauza,
      jlNumber: mouzaGisRecords.jlNo,
      mCode: mouzaGisRecords.mCode,
      mUpazila: mouzaGisRecords.mUpazila,
      mouzaId: mouzaGisRecords.mouzaId,
    })
    .from(mouzaGisRecords)
    .innerJoin(mouzaGisDatasets, eq(mouzaGisRecords.datasetId, mouzaGisDatasets.id))
    .where(
      and(
        eq(mouzaGisDatasets.districtId, districtId),
        ilike(mouzaGisRecords.mDistrict, "%dhaka%"),
      ),
    )
    .orderBy(asc(mouzaGisRecords.mauza));
}

export async function listPlotsByMouza(mouzaId: string) {
  return db
    .select({
      id: landParcels.id,
      plotNumber: landParcels.plotNumber,
      areaValue: landParcels.areaValue,
      areaUnit: landParcels.areaUnit,
    })
    .from(landParcels)
    .where(eq(landParcels.mouzaId, mouzaId))
    .orderBy(asc(landParcels.plotNumber))
    .limit(200);
}

export async function listPlotsByMouzaFromGis(
  mouzaId: string,
  mCode?: string,
) {
  const conditions = [eq(mouzaGisRecords.mouzaId, mouzaId)];
  if (mCode) {
    conditions.push(eq(mouzaGisRecords.mCode, mCode));
  }

  return db
    .select({
      id: mouzaGisRecords.id,
      parcelId: mouzaGisRecords.parcelId,
      plotNo: mouzaGisRecords.plotNo,
      mauza: mouzaGisRecords.mauza,
      jlNo: mouzaGisRecords.jlNo,
      mAcres: mouzaGisRecords.mAcres,
      landType: mouzaGisRecords.landType,
      landClass: mouzaGisRecords.landClass,
    })
    .from(mouzaGisRecords)
    .where(and(...conditions))
    .orderBy(asc(mouzaGisRecords.plotNo))
    .limit(200);
}

export async function getMouzaGisDetail(mouzaId: string, plotNo?: string) {
  const conditions = [eq(mouzaGisRecords.mouzaId, mouzaId)];
  if (plotNo) {
    conditions.push(eq(mouzaGisRecords.plotNo, plotNo));
  }

  const [record] = await db
    .select({
      id: mouzaGisRecords.id,
      plotNo: mouzaGisRecords.plotNo,
      mauza: mouzaGisRecords.mauza,
      jlNo: mouzaGisRecords.jlNo,
      sheetNo: mouzaGisRecords.sheetNo,
      revenueNo: mouzaGisRecords.revenueNo,
      project: mouzaGisRecords.project,
      mDistrict: mouzaGisRecords.mDistrict,
      mUpazila: mouzaGisRecords.mUpazila,
      landType: mouzaGisRecords.landType,
      landClass: mouzaGisRecords.landClass,
      mAcres: mouzaGisRecords.mAcres,
      khasArea: mouzaGisRecords.khasArea,
      shapeLeng: mouzaGisRecords.shapeLeng,
      shapeArea: mouzaGisRecords.shapeArea,
      scale: mouzaGisRecords.scale,
      prepDate: mouzaGisRecords.prepDate,
      mCode: mouzaGisRecords.mCode,
      mauzaJlS: mouzaGisRecords.mauzaJlS,
      featureId: mouzaGisRecords.featureId,
      syncStatus: mouzaGisRecords.syncStatus,
      syncMessage: mouzaGisRecords.syncMessage,
      parcelId: mouzaGisRecords.parcelId,
      unionName: unions.name,
    })
    .from(mouzaGisRecords)
    .leftJoin(mouzas, eq(mouzaGisRecords.mouzaId, mouzas.id))
    .leftJoin(unions, eq(mouzas.unionId, unions.id))
    .where(and(...conditions))
    .limit(1);

  if (!record) return null;

  let geometry: import("geojson").Geometry | null = null;
  let boundaryLength: string | null = null;
  let coordinates: string | null = null;

  if (record.featureId) {
    const result = await db.execute(sql`
      SELECT ST_AsGeoJSON(boundary) as geojson,
             ROUND(ST_Perimeter(boundary::geography)::numeric, 2)::text as perimeter_m,
             ST_X(ST_Centroid(boundary)) as centroid_lng,
             ST_Y(ST_Centroid(boundary)) as centroid_lat
      FROM mouza_gis_features
      WHERE id = ${record.featureId}::uuid
      LIMIT 1
    `);
    const rows =
      "rows" in result
        ? (result.rows as Array<{
            geojson: string;
            perimeter_m: string | null;
            centroid_lng: number | null;
            centroid_lat: number | null;
          }>)
        : (result as unknown as Array<{
            geojson: string;
            perimeter_m: string | null;
            centroid_lng: number | null;
            centroid_lat: number | null;
          }>);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row?.geojson) {
      geometry = JSON.parse(row.geojson);
    }
    if (row?.perimeter_m) {
      boundaryLength = `${row.perimeter_m} m`;
    }
    if (row?.centroid_lat != null && row?.centroid_lng != null) {
      coordinates = `${row.centroid_lat.toFixed(6)}°, ${row.centroid_lng.toFixed(6)}°`;
    }
  }

  let khatianNumbers: string | null = null;
  let currentOwners: string | null = null;
  let ownershipStatus: string | null = null;
  let ownerCount: number | null = null;
  let registeredDeedNumber: string | null = null;
  let registrationDate: string | null = null;
  let mutationStatus: string | null = null;
  let courtCaseStatus: string | null = null;
  let propertyId: string | null = null;
  let propertyCode: string | null = null;
  let registrationDeed: {
    id: string;
    fileName: string;
    mimeType: string;
  } | null = null;
  let mutationCertificate: {
    id: string;
    fileName: string;
    mimeType: string;
  } | null = null;

  if (record.parcelId) {
    const [
      parcelKhatians,
      parcelOwnership,
      parcelDeeds,
      parcelMutations,
      parcelCourtCases,
      linkedProperty,
    ] = await Promise.all([
      db.select().from(khatians).where(eq(khatians.parcelId, record.parcelId)),
      db
        .select({
          ownerName: owners.fullName,
          verificationStatus: ownershipRecords.verificationStatus,
          isCurrent: ownershipRecords.isCurrent,
        })
        .from(ownershipRecords)
        .innerJoin(owners, eq(ownershipRecords.ownerId, owners.id))
        .where(eq(ownershipRecords.parcelId, record.parcelId)),
      db.select().from(deeds).where(eq(deeds.parcelId, record.parcelId)),
      db.select().from(mutationCases).where(eq(mutationCases.parcelId, record.parcelId)),
      db.select().from(courtCases).where(eq(courtCases.parcelId, record.parcelId)),
      db
        .select({
          id: properties.id,
          propertyCode: properties.propertyCode,
        })
        .from(properties)
        .where(
          and(
            eq(properties.parcelId, record.parcelId),
            isNull(properties.deletedAt),
          ),
        )
        .limit(1),
    ]);

    if (parcelKhatians.length > 0) {
      khatianNumbers = parcelKhatians
        .map((k) => `${k.khatianType}: ${k.khatianNumber}`)
        .join(", ");
    }

    const activeOwners = parcelOwnership.filter((o) => o.isCurrent !== false);
    if (activeOwners.length > 0) {
      currentOwners = activeOwners.map((o) => o.ownerName).join(", ");
      ownerCount = activeOwners.length;
      const statuses = [
        ...new Set(
          activeOwners
            .map((o) => o.verificationStatus)
            .filter((status) => status != null),
        ),
      ];
      ownershipStatus = statuses.join(", ");
    }

    if (parcelDeeds.length > 0) {
      const latestDeed = parcelDeeds[0];
      registeredDeedNumber = latestDeed.deedNumber;
      registrationDate = latestDeed.registrationDate ?? null;
    }

    if (parcelMutations.length > 0) {
      mutationStatus = parcelMutations
        .map((m) => m.status ?? "not_applied")
        .join(", ");
    }

    if (parcelCourtCases.length > 0) {
      courtCaseStatus = parcelCourtCases
        .map((c) => c.status ?? "ongoing")
        .join(", ");
    }

    const property = linkedProperty[0];
    if (property) {
      propertyId = property.id;
      propertyCode = property.propertyCode;

      const [propertyDeed] = await db
        .select()
        .from(propertyDeeds)
        .where(eq(propertyDeeds.propertyId, property.id))
        .limit(1);

      if (propertyDeed) {
        registeredDeedNumber =
          propertyDeed.deedNumber ?? registeredDeedNumber;
        registrationDate =
          propertyDeed.registrationDate ?? registrationDate;
        mutationStatus =
          propertyDeed.namjariStatus ??
          propertyDeed.mutationCaseNumber ??
          mutationStatus;
      }

      const docs = await db
        .select({
          id: propertyDocuments.id,
          fileName: propertyDocuments.fileName,
          mimeType: propertyDocuments.mimeType,
          categorySlug: documentCategories.slug,
          createdAt: propertyDocuments.createdAt,
        })
        .from(propertyDocuments)
        .innerJoin(
          documentCategories,
          eq(propertyDocuments.categoryId, documentCategories.id),
        )
        .where(
          and(
            eq(propertyDocuments.propertyId, property.id),
            isNull(propertyDocuments.deletedAt),
            or(
              eq(documentCategories.slug, "deed_copy"),
              eq(documentCategories.slug, "mutation_certificate"),
            ),
          ),
        )
        .orderBy(desc(propertyDocuments.createdAt));

      for (const doc of docs) {
        if (doc.categorySlug === "deed_copy" && !registrationDeed) {
          registrationDeed = {
            id: doc.id,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
          };
        }
        if (
          doc.categorySlug === "mutation_certificate" &&
          !mutationCertificate
        ) {
          mutationCertificate = {
            id: doc.id,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
          };
        }
      }
    }
  }

  return {
    ...record,
    mAcres: record.mAcres != null ? String(record.mAcres) : null,
    khasArea: record.khasArea != null ? String(record.khasArea) : null,
    shapeLeng: record.shapeLeng != null ? String(record.shapeLeng) : null,
    shapeArea: record.shapeArea != null ? String(record.shapeArea) : null,
    prepDate: record.prepDate != null ? String(record.prepDate) : null,
    geometry,
    boundaryLength,
    coordinates,
    khatianNumbers,
    currentOwners,
    ownershipStatus,
    ownerCount,
    registeredDeedNumber,
    registrationDate,
    mutationStatus,
    courtCaseStatus,
    propertyId,
    propertyCode,
    registrationDeed,
    mutationCertificate,
  };
}

export async function getMouzaMapGeoJson(
  mouzaId: string,
  plotNo?: string,
) {
  const conditions = [
    eq(mouzaGisRecords.mouzaId, mouzaId),
    sql`${mouzaGisFeatures.boundary} IS NOT NULL`,
  ];
  if (plotNo) {
    conditions.push(eq(mouzaGisRecords.plotNo, plotNo));
  }

  const result = await db.execute<{
    geojson: string;
    record_id: string;
    plot_no: string;
    mauza: string;
    m_code: string;
    jl_no: string;
    sheet_no: string | null;
    revenue_no: string | null;
    project: string | null;
    m_district: string | null;
    m_upazila: string | null;
    land_type: string | null;
    land_class: string | null;
    m_acres: string | null;
    sync_status: string | null;
  }>(sql`
    SELECT ST_AsGeoJSON(f.boundary) as geojson,
           r.id as record_id,
           r.plot_no, r.mauza, r.m_code, r.jl_no,
           r.sheet_no, r.revenue_no, r.project,
           r.m_district, r.m_upazila, r.land_type, r.land_class,
           r.m_acres::text, r.sync_status
    FROM mouza_gis_records r
    INNER JOIN mouza_gis_features f ON f.id = r.feature_id
    WHERE r.mouza_id = ${mouzaId}::uuid
      AND f.boundary IS NOT NULL
    ${plotNo ? sql`AND r.plot_no = ${plotNo}` : sql``}
    LIMIT 5000
  `);

  const rows = "rows" in result ? result.rows : (result as unknown as typeof result[]);
  const rowList = Array.isArray(rows) ? rows : [];

  return {
    type: "FeatureCollection" as const,
    features: rowList.map((row) => ({
      type: "Feature" as const,
      id: row.record_id,
      properties: {
        recordId: row.record_id,
        plotNo: row.plot_no,
        mauza: row.mauza,
        mCode: row.m_code,
        jlNo: row.jl_no,
        sheetNo: row.sheet_no,
        revenueNo: row.revenue_no,
        project: row.project,
        mDistrict: row.m_district,
        mUpazila: row.m_upazila,
        landType: row.land_type,
        landClass: row.land_class,
        mAcres: row.m_acres,
        syncStatus: row.sync_status,
      },
      geometry: JSON.parse(row.geojson),
    })),
  };
}

export async function getDatasetImports(datasetId: string) {
  return db
    .select()
    .from(mouzaGisImports)
    .where(eq(mouzaGisImports.datasetId, datasetId))
    .orderBy(sql`${mouzaGisImports.createdAt} DESC`)
    .limit(20);
}

export async function getDatasetDbfUploads(datasetId: string) {
  return db
    .select()
    .from(mouzaDbfFiles)
    .where(eq(mouzaDbfFiles.datasetId, datasetId))
    .orderBy(sql`${mouzaDbfFiles.uploadedAt} DESC`)
    .limit(20);
}

export type MouzaActivityLog = {
  id: string;
  type: "import" | "shapefile";
  fileName: string;
  status: string;
  recordCount: number;
  successCount: number | null;
  errorCount: number | null;
  message: string | null;
  errors: Array<{ row?: number; message: string }> | null;
  version: number | null;
  isActive: boolean | null;
  storage: "cloudinary" | "local" | null;
  createdAt: Date | null;
};

export async function getDatasetActivityLogs(
  datasetId: string,
): Promise<MouzaActivityLog[]> {
  const [imports, uploads] = await Promise.all([
    getDatasetImports(datasetId),
    getDatasetDbfUploads(datasetId),
  ]);

  const importLogs: MouzaActivityLog[] = imports.map((row) => ({
    id: row.id,
    type: "import",
    fileName: row.fileName,
    status: row.status,
    recordCount: row.recordCount ?? 0,
    successCount: row.successCount,
    errorCount: row.errorCount,
    message:
      row.errorCount && row.errorCount > 0
        ? `${row.errorCount} row error(s)`
        : `${row.successCount ?? 0} rows imported`,
    errors: Array.isArray(row.errors)
      ? (row.errors as Array<{ row?: number; message: string }>)
      : null,
    version: null,
    isActive: null,
    storage: null,
    createdAt: row.createdAt,
  }));

  const uploadLogs: MouzaActivityLog[] = uploads.map((row) => {
    const isLocal = row.cloudinaryPublicId.startsWith("local/");
    return {
      id: row.id,
      type: "shapefile",
      fileName: row.fileName,
      status: row.isActive ? "active" : "archived",
      recordCount: row.recordCount ?? 0,
      successCount: row.recordCount,
      errorCount: null,
      message: `v${row.version} · ${row.recordCount ?? 0} features · ${row.format ?? "unknown"}${isLocal ? " · stored locally" : ""}`,
      errors: null,
      version: row.version,
      isActive: row.isActive,
      storage: isLocal ? "local" : "cloudinary",
      createdAt: row.uploadedAt,
    };
  });

  return [...importLogs, ...uploadLogs].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export async function getActiveDbfFile(datasetId: string) {
  const [file] = await db
    .select()
    .from(mouzaDbfFiles)
    .where(
      and(
        eq(mouzaDbfFiles.datasetId, datasetId),
        eq(mouzaDbfFiles.isActive, true),
      ),
    )
    .limit(1);
  return file ?? null;
}

export async function listMouzaRegistry(limit = 100, datasetId?: string) {
  const conditions = datasetId
    ? [
        sql`EXISTS (
          SELECT 1 FROM mouza_gis_records r
          WHERE r.mouza_id = ${mouzas.id}
            AND r.dataset_id = ${datasetId}::uuid
        )`,
      ]
    : [];

  return db
    .select({
      id: mouzas.id,
      name: mouzas.name,
      jlNumber: mouzas.jlNumber,
      mCode: mouzas.mCode,
      upazilaName: upazilas.name,
      districtName: districts.name,
      datasetId: mouzas.datasetId,
      plotCount: datasetId
        ? sql<number>`(
            SELECT COUNT(*)::int FROM mouza_gis_records r
            WHERE r.mouza_id = ${mouzas.id}
              AND r.dataset_id = ${datasetId}::uuid
              AND r.sync_status = 'synced'
          )`
        : sql<number>`(
            SELECT COUNT(*)::int FROM mouza_gis_records r
            WHERE r.mouza_id = ${mouzas.id}
              AND r.sync_status = 'synced'
          )`,
      hasGis: datasetId
        ? sql<boolean>`EXISTS (
            SELECT 1 FROM mouza_gis_records r
            WHERE r.mouza_id = ${mouzas.id}
              AND r.dataset_id = ${datasetId}::uuid
              AND r.sync_status = 'synced'
          )`
        : sql<boolean>`EXISTS (
            SELECT 1 FROM mouza_gis_records r
            WHERE r.mouza_id = ${mouzas.id}
              AND r.sync_status = 'synced'
          )`,
      geometryStatus: sql<string | null>`(
        SELECT sync_status FROM mouza_gis_records r
        WHERE r.mouza_id = ${mouzas.id}
        ${datasetId ? sql`AND r.dataset_id = ${datasetId}::uuid` : sql``}
        ORDER BY r.updated_at DESC
        LIMIT 1
      )`,
    })
    .from(mouzas)
    .leftJoin(upazilas, eq(mouzas.upazilaId, upazilas.id))
    .leftJoin(districts, eq(upazilas.districtId, districts.id))
    .where(conditions.length > 0 ? and(...conditions) : sql`true`)
    .orderBy(asc(mouzas.name))
    .limit(limit);
}

export async function findDhakaNorthDistrict() {
  return findDistrictByName("dhaka");
}

export async function findDistrictByName(name: string) {
  const [row] = await db
    .select()
    .from(districts)
    .where(ilike(districts.name, `%${name}%`))
    .limit(1);
  return row ?? null;
}

export async function listUpazilasForDataset(datasetId: string) {
  return db
    .selectDistinct({
      name: mouzaGisRecords.mUpazila,
    })
    .from(mouzaGisRecords)
    .where(eq(mouzaGisRecords.datasetId, datasetId))
    .orderBy(asc(mouzaGisRecords.mUpazila));
}

export async function listUpazilasForDhakaNorth(districtId: string) {
  return db
    .selectDistinct({
      name: mouzaGisRecords.mUpazila,
    })
    .from(mouzaGisRecords)
    .innerJoin(mouzaGisDatasets, eq(mouzaGisRecords.datasetId, mouzaGisDatasets.id))
    .where(eq(mouzaGisDatasets.districtId, districtId))
    .orderBy(asc(mouzaGisRecords.mUpazila));
}

export async function listMouzasForUpazilaName(
  datasetId: string,
  upazilaName: string,
) {
  return db
    .selectDistinct({
      mouzaId: mouzaGisRecords.mouzaId,
      name: mouzaGisRecords.mauza,
      jlNumber: mouzaGisRecords.jlNo,
      mCode: mouzaGisRecords.mCode,
      syncStatus: mouzaGisRecords.syncStatus,
    })
    .from(mouzaGisRecords)
    .where(
      and(
        eq(mouzaGisRecords.datasetId, datasetId),
        ilike(mouzaGisRecords.mUpazila, upazilaName),
      ),
    )
    .orderBy(asc(mouzaGisRecords.mauza));
}

export type MouzaSearchResult = {
  recordId: string;
  mouzaId: string | null;
  parcelId: string | null;
  mauza: string;
  mCode: string;
  jlNo: string;
  plotNo: string | null;
  mDistrict: string | null;
  mUpazila: string | null;
  syncStatus: string | null;
  centroid: string | null;
};

export async function searchMouzaRecords(
  query: string,
  filters?: {
    datasetId?: string;
    district?: string;
    upazila?: string;
    mouza?: string;
    jlNo?: string;
    mCode?: string;
    plotNo?: string;
  },
  limit = 25,
): Promise<MouzaSearchResult[]> {
  const pattern = `%${query.trim()}%`;
  const conditions = [
    or(
      ilike(mouzaGisRecords.mauza, pattern),
      ilike(mouzaGisRecords.mCode, pattern),
      ilike(mouzaGisRecords.jlNo, pattern),
      ilike(mouzaGisRecords.plotNo, pattern),
      ilike(mouzaGisRecords.mDistrict, pattern),
      ilike(mouzaGisRecords.mUpazila, pattern),
      ilike(mouzaGisRecords.mauzaJlS, pattern),
    ),
  ];

  if (filters?.datasetId) {
    conditions.push(eq(mouzaGisRecords.datasetId, filters.datasetId));
  }
  if (filters?.district) {
    conditions.push(ilike(mouzaGisRecords.mDistrict, `%${filters.district}%`));
  }
  if (filters?.upazila) {
    conditions.push(ilike(mouzaGisRecords.mUpazila, `%${filters.upazila}%`));
  }
  if (filters?.mouza) {
    conditions.push(ilike(mouzaGisRecords.mauza, `%${filters.mouza}%`));
  }
  if (filters?.jlNo) {
    conditions.push(ilike(mouzaGisRecords.jlNo, `%${filters.jlNo}%`));
  }
  if (filters?.mCode) {
    conditions.push(ilike(mouzaGisRecords.mCode, `%${filters.mCode}%`));
  }
  if (filters?.plotNo) {
    conditions.push(ilike(mouzaGisRecords.plotNo, `%${filters.plotNo}%`));
  }

  const rows = await db
    .select({
      recordId: mouzaGisRecords.id,
      mouzaId: mouzaGisRecords.mouzaId,
      parcelId: mouzaGisRecords.parcelId,
      mauza: mouzaGisRecords.mauza,
      mCode: mouzaGisRecords.mCode,
      jlNo: mouzaGisRecords.jlNo,
      plotNo: mouzaGisRecords.plotNo,
      mDistrict: mouzaGisRecords.mDistrict,
      mUpazila: mouzaGisRecords.mUpazila,
      syncStatus: mouzaGisRecords.syncStatus,
      featureId: mouzaGisRecords.featureId,
    })
    .from(mouzaGisRecords)
    .where(and(...conditions))
    .orderBy(asc(mouzaGisRecords.mauza))
    .limit(limit);

  const results: MouzaSearchResult[] = [];

  for (const row of rows) {
    let centroid: string | null = null;
    if (row.featureId) {
      const geomResult = await db.execute<{ centroid: string }>(sql`
        SELECT ST_AsGeoJSON(ST_Centroid(boundary)) as centroid
        FROM mouza_gis_features
        WHERE id = ${row.featureId}::uuid
          AND boundary IS NOT NULL
        LIMIT 1
      `);
      const geomRows =
        "rows" in geomResult
          ? geomResult.rows
          : (geomResult as unknown as { centroid: string }[]);
      const geomRow = Array.isArray(geomRows) ? geomRows[0] : geomRows;
      centroid = geomRow?.centroid ?? null;
    }

    results.push({
      recordId: row.recordId,
      mouzaId: row.mouzaId,
      parcelId: row.parcelId,
      mauza: row.mauza,
      mCode: row.mCode,
      jlNo: row.jlNo,
      plotNo: row.plotNo,
      mDistrict: row.mDistrict,
      mUpazila: row.mUpazila,
      syncStatus: row.syncStatus,
      centroid,
    });
  }

  return results;
}

export async function getSynchronizedDatasetGeoJson(
  datasetId: string,
  options?: {
    limit?: number;
    bbox?: MapBBox;
    zoom?: number;
  },
) {
  const zoom = options?.zoom;
  const limit =
    options?.limit ??
    (options?.bbox ? defaultViewportFeatureLimit(zoom) : 5000);
  const tolerance = simplifyToleranceForZoom(zoom);
  const bbox = options?.bbox;

  const bboxFilter = bbox
    ? sql`AND f.boundary && ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)
         AND ST_Intersects(
           f.boundary,
           ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)
         )`
    : sql``;

  const geomExpr =
    tolerance > 0
      ? sql`ST_AsGeoJSON(ST_SimplifyPreserveTopology(f.boundary, ${tolerance}))`
      : sql`ST_AsGeoJSON(f.boundary)`;

  const result = await db.execute<{
    geojson: string;
    record_id: string;
    mouza_id: string | null;
    plot_no: string | null;
    mauza: string;
    m_code: string;
    jl_no: string;
    sheet_no: string | null;
    revenue_no: string | null;
    project: string | null;
    m_district: string | null;
    m_upazila: string | null;
    land_type: string | null;
    land_class: string | null;
    m_acres: string | null;
    sync_status: string | null;
  }>(sql`
    SELECT
      ${geomExpr} as geojson,
      r.id as record_id,
      r.mouza_id,
      r.plot_no,
      r.mauza,
      r.m_code,
      r.jl_no,
      r.sheet_no,
      r.revenue_no,
      r.project,
      r.m_district,
      r.m_upazila,
      r.land_type,
      r.land_class,
      r.m_acres::text,
      r.sync_status
    FROM mouza_gis_records r
    INNER JOIN mouza_gis_features f ON f.id = r.feature_id
    WHERE r.dataset_id = ${datasetId}::uuid
      AND r.sync_status = 'synced'
      AND f.boundary IS NOT NULL
      ${bboxFilter}
    ORDER BY r.mauza, r.plot_no
    LIMIT ${limit}
  `);

  const rows =
    "rows" in result ? result.rows : (result as unknown as typeof result[]);
  const rowList = Array.isArray(rows) ? rows : [];

  return {
    type: "FeatureCollection" as const,
    features: rowList.map((row) => ({
      type: "Feature" as const,
      id: row.record_id,
      properties: {
        recordId: row.record_id,
        mouzaId: row.mouza_id,
        plotNo: row.plot_no,
        mauza: row.mauza,
        mCode: row.m_code,
        jlNo: row.jl_no,
        sheetNo: row.sheet_no,
        revenueNo: row.revenue_no,
        project: row.project,
        mDistrict: row.m_district,
        mUpazila: row.m_upazila,
        landType: row.land_type,
        landClass: row.land_class,
        mAcres: row.m_acres,
        syncStatus: row.sync_status,
      },
      geometry: JSON.parse(row.geojson),
    })),
    meta: {
      returned: rowList.length,
      bbox: bbox ?? null,
      zoom: zoom ?? null,
      truncated: rowList.length >= limit,
    },
  };
}

export async function getMouzaRecordById(recordId: string) {
  const [record] = await db
    .select()
    .from(mouzaGisRecords)
    .where(eq(mouzaGisRecords.id, recordId))
    .limit(1);
  return record ?? null;
}
