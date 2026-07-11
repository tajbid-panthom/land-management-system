import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  districts,
  upazilas,
  mouzas,
  landParcels,
  mouzaGisDatasets,
  mouzaGisRecords,
  mouzaGisFeatures,
  mouzaDbfFiles,
  mouzaGisImports,
} from "@/lib/db/schema";

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
      scale: mouzaGisRecords.scale,
      prepDate: mouzaGisRecords.prepDate,
      mCode: mouzaGisRecords.mCode,
      featureId: mouzaGisRecords.featureId,
      parcelId: mouzaGisRecords.parcelId,
    })
    .from(mouzaGisRecords)
    .where(and(...conditions))
    .limit(1);

  if (!record) return null;

  let geometry: import("geojson").Geometry | null = null;
  if (record.featureId) {
    const result = await db.execute<{ geojson: string }>(sql`
      SELECT ST_AsGeoJSON(boundary) as geojson
      FROM mouza_gis_features
      WHERE id = ${record.featureId}::uuid
      LIMIT 1
    `);
    const rows = "rows" in result ? result.rows : (result as unknown as { geojson: string }[]);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row?.geojson) {
      geometry = JSON.parse(row.geojson);
    }
  }

  return { ...record, geometry };
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
    plot_no: string;
    mauza: string;
    m_code: string;
    jl_no: string;
  }>(sql`
    SELECT ST_AsGeoJSON(f.boundary) as geojson,
           r.plot_no, r.mauza, r.m_code, r.jl_no
    FROM mouza_gis_records r
    INNER JOIN mouza_gis_features f ON f.id = r.feature_id
    WHERE r.mouza_id = ${mouzaId}::uuid
    ${plotNo ? sql`AND r.plot_no = ${plotNo}` : sql``}
    LIMIT 100
  `);

  const rows = "rows" in result ? result.rows : (result as unknown as typeof result[]);
  const rowList = Array.isArray(rows) ? rows : [];

  return {
    type: "FeatureCollection" as const,
    features: rowList.map((row) => ({
      type: "Feature" as const,
      properties: {
        plotNo: row.plot_no,
        mauza: row.mauza,
        mCode: row.m_code,
        jlNo: row.jl_no,
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

export async function listMouzaRegistry(limit = 100) {
  return db
    .select({
      id: mouzas.id,
      name: mouzas.name,
      jlNumber: mouzas.jlNumber,
      mCode: mouzas.mCode,
      upazilaName: upazilas.name,
      districtName: districts.name,
      hasGis: sql<boolean>`EXISTS (
        SELECT 1 FROM mouza_gis_records WHERE mouza_id = ${mouzas.id}
      )`,
    })
    .from(mouzas)
    .leftJoin(upazilas, eq(mouzas.upazilaId, upazilas.id))
    .leftJoin(districts, eq(upazilas.districtId, districts.id))
    .orderBy(asc(mouzas.name))
    .limit(limit);
}

export async function findDhakaNorthDistrict() {
  const [row] = await db
    .select()
    .from(districts)
    .where(ilike(districts.name, "%dhaka%"))
    .limit(1);
  return row ?? null;
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
  districtId: string,
  upazilaName: string,
) {
  return db
    .selectDistinct({
      mouzaId: mouzaGisRecords.mouzaId,
      name: mouzaGisRecords.mauza,
      jlNumber: mouzaGisRecords.jlNo,
      mCode: mouzaGisRecords.mCode,
    })
    .from(mouzaGisRecords)
    .innerJoin(mouzaGisDatasets, eq(mouzaGisRecords.datasetId, mouzaGisDatasets.id))
    .where(
      and(
        eq(mouzaGisDatasets.districtId, districtId),
        ilike(mouzaGisRecords.mUpazila, upazilaName),
      ),
    )
    .orderBy(asc(mouzaGisRecords.mauza));
}
