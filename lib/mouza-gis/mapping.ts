import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  mouzaGisRecords,
  mouzaGisFeatures,
  mouzaDbfFiles,
  mouzas,
  landParcels,
  upazilas,
} from "@/lib/db/schema";
import { geometryToWkt } from "./shapefile-service";
import type { ParsedFeature } from "./shapefile-service";
import type { SynchronizeReport, SyncRecordReport } from "./validations";
import { buildRecordKey, dbfAttributesToDbValues } from "./excel-import";
import { fixWrongUtmZoneGeometries } from "./reproject";

function geometrySql(wkt: string, sourceEpsg = 4326) {
  if (sourceEpsg === 4326) {
    return sql`ST_SetSRID(ST_GeomFromText(${wkt}), 4326)::geometry(Geometry, 4326)`;
  }
  return sql`ST_Transform(ST_SetSRID(ST_GeomFromText(${wkt}), ${sourceEpsg}), 4326)::geometry(Geometry, 4326)`;
}

export type MappingResult = SynchronizeReport;

const BATCH_SIZE = 100;
const INSERT_BATCH_SIZE = 250;

type SyncCache = {
  upazilaByName: Map<string, string | null>;
  mouzaByMCode: Map<string, string>;
  parcelByKey: Map<string, string>;
};

type LeanFeature = {
  id: string;
  mCode: string | null;
  plotNo: string | null;
  mauzaJlS: string | null;
  hasBoundary: boolean;
};

async function getUpazilaIdCached(
  mUpazila: string | null,
  cache: SyncCache,
): Promise<string | null> {
  if (!mUpazila) return null;
  const key = mUpazila.toLowerCase();
  if (cache.upazilaByName.has(key)) {
    return cache.upazilaByName.get(key) ?? null;
  }
  const id = await findUpazilaId(mUpazila, null);
  cache.upazilaByName.set(key, id);
  return id;
}

function buildMatchKey(
  mCode: string | null,
  plotNo: string | null,
  mauzaJlS: string | null,
): string | null {
  if (mCode && plotNo) return `${mCode}::${plotNo}`;
  if (mauzaJlS && plotNo) return `${mauzaJlS}::${plotNo}`;
  if (mCode) return mCode;
  if (mauzaJlS) return mauzaJlS;
  return null;
}

export async function synchronizeDataset(
  datasetId: string,
): Promise<SynchronizeReport> {
  await fixWrongUtmZoneGeometries(datasetId);

  const report: SynchronizeReport = {
    synced: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    geometryMissing: 0,
    duplicateGeometries: 0,
    unmatchedRecords: 0,
    unmatchedFeatures: 0,
    records: [],
    errors: [],
  };

  const [activeDbf] = await db
    .select()
    .from(mouzaDbfFiles)
    .where(
      and(
        eq(mouzaDbfFiles.datasetId, datasetId),
        eq(mouzaDbfFiles.isActive, true),
      ),
    )
    .limit(1);

  if (!activeDbf) {
    report.errors.push("No active shapefile found for this dataset");
    return report;
  }

  const records = await db
    .select()
    .from(mouzaGisRecords)
    .where(eq(mouzaGisRecords.datasetId, datasetId));

  const featuresResult = await db.execute<{
    id: string;
    m_code: string | null;
    plot_no: string | null;
    mauza_jl_s: string | null;
    has_boundary: boolean;
  }>(sql`
    SELECT id, m_code, plot_no, mauza_jl_s,
           (boundary IS NOT NULL) as has_boundary
    FROM mouza_gis_features
    WHERE dataset_id = ${datasetId}::uuid
  `);
  const featureRows =
    "rows" in featuresResult
      ? featuresResult.rows
      : (featuresResult as unknown as typeof featuresResult[]);
  const features: LeanFeature[] = (Array.isArray(featureRows) ? featureRows : []).map(
    (row) => ({
      id: row.id,
      mCode: row.m_code,
      plotNo: row.plot_no,
      mauzaJlS: row.mauza_jl_s,
      hasBoundary: row.has_boundary,
    }),
  );

  const featureMap = new Map<string, LeanFeature>();
  const geometryOwners = new Map<string, string>();
  const usedFeatures = new Set<string>();

  for (const feature of features) {
    const key = buildMatchKey(feature.mCode, feature.plotNo, feature.mauzaJlS);
    if (key && !featureMap.has(key)) {
      featureMap.set(key, feature);
    }

    if (feature.hasBoundary) {
      const geomKey = `${feature.mCode ?? ""}::${feature.plotNo ?? ""}::${feature.mauzaJlS ?? ""}`;
      if (geometryOwners.has(geomKey) && geometryOwners.get(geomKey) !== feature.id) {
        report.duplicateGeometries++;
      } else {
        geometryOwners.set(geomKey, feature.id);
      }
    }
  }

  const mouzaIdsToRebuild = new Set<string>();
  const cache: SyncCache = {
    upazilaByName: new Map(),
    mouzaByMCode: new Map(),
    parcelByKey: new Map(),
  };

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const record of batch) {
      const entry: SyncRecordReport = {
        recordId: record.id,
        mCode: record.mCode,
        plotNo: record.plotNo,
        mauza: record.mauza,
        status: "unmatched",
      };

      const primaryKey = buildMatchKey(
        record.mCode,
        record.plotNo,
        record.mauzaJlS,
      );
      const fallbackKey = buildMatchKey(record.mCode, null, record.mauzaJlS);
      const jlKey =
        record.jlNo && record.plotNo
          ? `${record.jlNo}::${record.plotNo}`
          : null;

      const feature =
        (primaryKey && featureMap.get(primaryKey)) ||
        (fallbackKey && featureMap.get(fallbackKey)) ||
        (jlKey && featureMap.get(jlKey)) ||
        null;

      if (!feature) {
        report.unmatchedRecords++;
        report.geometryMissing++;
        entry.status = "geometry_missing";
        entry.reason = "No matching GIS feature found";
        report.records.push(entry);

        await db
          .update(mouzaGisRecords)
          .set({
            syncStatus: "geometry_missing",
            syncMessage: entry.reason,
            updatedAt: new Date(),
          })
          .where(eq(mouzaGisRecords.id, record.id));
        continue;
      }

      if (!feature.hasBoundary) {
        report.geometryMissing++;
        entry.status = "geometry_missing";
        entry.reason = "GIS feature has no geometry";
        report.records.push(entry);

        await db
          .update(mouzaGisRecords)
          .set({
            syncStatus: "geometry_missing",
            syncMessage: entry.reason,
            updatedAt: new Date(),
          })
          .where(eq(mouzaGisRecords.id, record.id));
        continue;
      }

      if (usedFeatures.has(feature.id)) {
        report.duplicateGeometries++;
        entry.status = "duplicate_geometry";
        entry.reason = "Multiple records matched the same GIS geometry";
        report.records.push(entry);

        await db
          .update(mouzaGisRecords)
          .set({
            syncStatus: "duplicate_geometry",
            syncMessage: entry.reason,
            updatedAt: new Date(),
          })
          .where(eq(mouzaGisRecords.id, record.id));
        continue;
      }

      const alreadySynced =
        record.mappedAt &&
        record.featureId === feature.id &&
        record.syncStatus === "synced" &&
        record.mouzaId &&
        record.parcelId;

      if (alreadySynced) {
        report.skipped++;
        entry.status = "skipped";
        entry.reason = "No changes detected";
        report.records.push(entry);
        usedFeatures.add(feature.id);
        continue;
      }

      try {
        const mouzaId = await upsertMouzaFromRecord(record, datasetId, cache);
        const parcelId = await upsertParcelFromRecord(
          record,
          mouzaId,
          feature.id,
          cache,
        );

        await db
          .update(mouzaGisRecords)
          .set({
            mouzaId,
            parcelId,
            featureId: feature.id,
            mappedAt: new Date(),
            syncStatus: "synced",
            syncMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(mouzaGisRecords.id, record.id));

        await db
          .update(mouzaGisFeatures)
          .set({
            gisRecordId: record.id,
            mappedAt: new Date(),
          })
          .where(eq(mouzaGisFeatures.id, feature.id));

        usedFeatures.add(feature.id);
        mouzaIdsToRebuild.add(mouzaId);

        if (record.mappedAt) {
          report.updated++;
          entry.status = "updated";
        } else {
          report.synced++;
          entry.status = "synced";
        }
        report.records.push(entry);
      } catch (err) {
        report.failed++;
        const message =
          err instanceof Error ? err.message : "Synchronization failed";
        report.errors.push(`Record ${record.id}: ${message}`);
        entry.status = "failed";
        entry.reason = message;
        report.records.push(entry);

        await db
          .update(mouzaGisRecords)
          .set({
            syncStatus: "failed",
            syncMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(mouzaGisRecords.id, record.id));
      }
    }
  }

  report.unmatchedFeatures = features.length - usedFeatures.size;

  if (report.records.length > 100) {
    report.records = report.records.slice(0, 100);
  }

  for (const mouzaId of mouzaIdsToRebuild) {
    await rebuildMouzaBoundary(mouzaId);
  }

  return report;
}

/** @deprecated Use synchronizeDataset */
export async function mapDatasetRecords(
  datasetId: string,
): Promise<MappingResult> {
  return synchronizeDataset(datasetId);
}

async function findUpazilaId(
  mUpazila: string | null,
  mDistrict: string | null,
): Promise<string | null> {
  if (!mUpazila) return null;
  const rows = await db
    .select({ id: upazilas.id })
    .from(upazilas)
    .where(sql`LOWER(${upazilas.name}) = LOWER(${mUpazila})`)
    .limit(1);
  return rows[0]?.id ?? null;
}

async function upsertMouzaFromRecord(
  record: typeof mouzaGisRecords.$inferSelect,
  datasetId: string,
  cache: SyncCache,
): Promise<string> {
  const cacheKey = `${record.mCode ?? ""}::${record.mUpazila ?? ""}`;
  const cached = record.mCode ? cache.mouzaByMCode.get(cacheKey) : undefined;
  if (cached) {
    return cached;
  }

  if (record.mouzaId) {
    const upazilaId = await getUpazilaIdCached(record.mUpazila, cache);
    await db
      .update(mouzas)
      .set({
        name: record.mauza,
        mCode: record.mCode,
        datasetId,
        upazilaId: upazilaId ?? undefined,
      })
      .where(eq(mouzas.id, record.mouzaId));
    cache.mouzaByMCode.set(cacheKey, record.mouzaId);
    return record.mouzaId;
  }

  const upazilaId = await getUpazilaIdCached(record.mUpazila, cache);

  if (record.mCode) {
    const byMCode = await db
      .select({ id: mouzas.id })
      .from(mouzas)
      .where(
        and(
          eq(mouzas.mCode, record.mCode),
          upazilaId ? eq(mouzas.upazilaId, upazilaId) : sql`true`,
        ),
      )
      .limit(1);

    if (byMCode[0]) {
      await db
        .update(mouzas)
        .set({
          name: record.mauza,
          jlNumber: record.jlNo,
          datasetId,
          upazilaId: upazilaId ?? undefined,
        })
        .where(eq(mouzas.id, byMCode[0].id));
      cache.mouzaByMCode.set(cacheKey, byMCode[0].id);
      return byMCode[0].id;
    }
  }

  const existing = await db
    .select({ id: mouzas.id })
    .from(mouzas)
    .where(
      and(
        eq(mouzas.jlNumber, record.jlNo),
        upazilaId ? eq(mouzas.upazilaId, upazilaId) : sql`true`,
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(mouzas)
      .set({
        name: record.mauza,
        mCode: record.mCode,
        datasetId,
        upazilaId: upazilaId ?? undefined,
      })
      .where(eq(mouzas.id, existing[0].id));
    cache.mouzaByMCode.set(cacheKey, existing[0].id);
    return existing[0].id;
  }

  const [created] = await db
    .insert(mouzas)
    .values({
      name: record.mauza,
      jlNumber: record.jlNo,
      mCode: record.mCode,
      upazilaId: upazilaId ?? undefined,
      datasetId,
    })
    .returning({ id: mouzas.id });

  cache.mouzaByMCode.set(cacheKey, created.id);
  return created.id;
}

async function upsertParcelFromRecord(
  record: typeof mouzaGisRecords.$inferSelect,
  mouzaId: string,
  featureId: string,
  cache: SyncCache,
): Promise<string> {
  const plotNumber = record.plotNo ?? "unknown";
  const areaValue = record.mAcres ?? record.shapeArea ?? "0";
  const parcelKey = `${mouzaId}::${plotNumber}`;
  const cachedParcel = cache.parcelByKey.get(parcelKey);
  if (cachedParcel) {
    await db.execute(sql`
      UPDATE land_parcels
      SET area_value = ${areaValue},
          area_unit = 'acre',
          updated_at = NOW(),
          boundary = (SELECT boundary FROM mouza_gis_features WHERE id = ${featureId}::uuid)
      WHERE id = ${cachedParcel}::uuid
    `);
    return cachedParcel;
  }

  const existing = await db
    .select({ id: landParcels.id })
    .from(landParcels)
    .where(
      and(
        eq(landParcels.mouzaId, mouzaId),
        eq(landParcels.plotNumber, plotNumber),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db.execute(sql`
      UPDATE land_parcels
      SET area_value = ${areaValue},
          area_unit = 'acre',
          updated_at = NOW(),
          boundary = (SELECT boundary FROM mouza_gis_features WHERE id = ${featureId}::uuid)
      WHERE id = ${existing[0].id}::uuid
    `);
    cache.parcelByKey.set(parcelKey, existing[0].id);
    return existing[0].id;
  }

  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO land_parcels (mouza_id, plot_number, area_value, area_unit, status, boundary)
    VALUES (
      ${mouzaId}::uuid,
      ${plotNumber},
      ${areaValue},
      'acre',
      'active',
      (SELECT boundary FROM mouza_gis_features WHERE id = ${featureId}::uuid)
    )
    RETURNING id
  `);
  const rows = "rows" in result ? result.rows : (result as unknown as { id: string }[]);
  const row = Array.isArray(rows) ? rows[0] : rows;
  cache.parcelByKey.set(parcelKey, row.id);
  return row.id;
}

export async function rebuildMouzaBoundary(mouzaId: string): Promise<void> {
  await db.execute(sql`
    UPDATE mouzas
    SET boundary = (
      SELECT ST_Multi(ST_Union(f.boundary))
      FROM mouza_gis_records r
      INNER JOIN mouza_gis_features f ON f.id = r.feature_id
      WHERE r.mouza_id = ${mouzaId}::uuid
        AND f.boundary IS NOT NULL
    )
    WHERE id = ${mouzaId}::uuid
  `);
}

export async function cleanupMouzaSync(mouzaId: string): Promise<void> {
  const linkedRecords = await db
    .select({ id: mouzaGisRecords.id })
    .from(mouzaGisRecords)
    .where(eq(mouzaGisRecords.mouzaId, mouzaId));

  const recordIds = linkedRecords.map((r) => r.id);

  if (recordIds.length > 0) {
    await db
      .update(mouzaGisFeatures)
      .set({
        gisRecordId: null,
        mappedAt: null,
      })
      .where(
        sql`${mouzaGisFeatures.gisRecordId} IN (${sql.join(
          recordIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
      );

    await db
      .update(mouzaGisRecords)
      .set({
        mouzaId: null,
        parcelId: null,
        featureId: null,
        mappedAt: null,
        syncStatus: "unmatched",
        syncMessage: "Mouza record deleted",
        updatedAt: new Date(),
      })
      .where(eq(mouzaGisRecords.mouzaId, mouzaId));
  }

  await db.delete(landParcels).where(eq(landParcels.mouzaId, mouzaId));
  await db.delete(mouzas).where(eq(mouzas.id, mouzaId));
}

export async function rebuildRecordsFromFeatures(
  datasetId: string,
): Promise<number> {
  await db
    .delete(mouzaGisRecords)
    .where(eq(mouzaGisRecords.datasetId, datasetId));

  const features = await db
    .select({
      mCode: mouzaGisFeatures.mCode,
      mauzaJlS: mouzaGisFeatures.mauzaJlS,
      jlNo: mouzaGisFeatures.jlNo,
      plotNo: mouzaGisFeatures.plotNo,
      mauza: mouzaGisFeatures.mauza,
      dbfAttributes: mouzaGisFeatures.dbfAttributes,
    })
    .from(mouzaGisFeatures)
    .where(eq(mouzaGisFeatures.datasetId, datasetId));

  const rows: Array<typeof mouzaGisRecords.$inferInsert> = [];
  const seenKeys = new Set<string>();

  for (const feature of features) {
    const attrs = (feature.dbfAttributes ?? {}) as Record<string, unknown>;
    const values = dbfAttributesToDbValues(attrs);

    values.mCode = feature.mCode ?? values.mCode;
    values.mauzaJlS = feature.mauzaJlS ?? values.mauzaJlS;
    values.jlNo = feature.jlNo ?? values.jlNo;
    values.plotNo = feature.plotNo ?? values.plotNo;
    values.mauza = feature.mauza ?? values.mauza;

    const key = buildRecordKey(values.mCode, values.plotNo);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    rows.push({
      datasetId,
      ...values,
      syncStatus: "pending",
      syncMessage: "Pending synchronization from shapefile",
    });
  }

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    await db.insert(mouzaGisRecords).values(rows.slice(i, i + INSERT_BATCH_SIZE));
  }

  return rows.length;
}

export async function insertFeaturesFromParsed(
  datasetId: string,
  dbfFileId: string,
  parsedFeatures: ParsedFeature[],
  sourceEpsg = 4326,
): Promise<number> {
  let inserted = 0;
  const seenKeys = new Set<string>();
  const withoutGeometry: Array<typeof mouzaGisFeatures.$inferInsert> = [];
  const withGeometry: Array<{
    datasetId: string;
    dbfFileId: string;
    mCode: string | null;
    mauzaJlS: string | null;
    jlNo: string | null;
    plotNo: string | null;
    mauza: string | null;
    dbfAttributes: Record<string, unknown>;
    boundary: string;
  }> = [];

  for (const f of parsedFeatures) {
    const key = buildRecordKey(f.matchKeys.mCode ?? "", f.matchKeys.plotNo);
    if (key && seenKeys.has(key)) {
      continue;
    }
    if (key) seenKeys.add(key);

    const val = {
      datasetId,
      dbfFileId,
      mCode: f.matchKeys.mCode,
      mauzaJlS: f.matchKeys.mauzaJlS,
      jlNo: f.matchKeys.jlNo,
      plotNo: f.matchKeys.plotNo,
      mauza: f.matchKeys.mauza,
      dbfAttributes: f.attributes,
      boundary: f.geometry ? geometryToWkt(f.geometry) : null,
    };

    if (val.boundary) {
      withGeometry.push({
        datasetId: val.datasetId,
        dbfFileId: val.dbfFileId,
        mCode: val.mCode,
        mauzaJlS: val.mauzaJlS,
        jlNo: val.jlNo,
        plotNo: val.plotNo,
        mauza: val.mauza,
        dbfAttributes: val.dbfAttributes,
        boundary: val.boundary,
      });
    } else {
      withoutGeometry.push({
        datasetId: val.datasetId,
        dbfFileId: val.dbfFileId,
        mCode: val.mCode,
        mauzaJlS: val.mauzaJlS,
        jlNo: val.jlNo,
        plotNo: val.plotNo,
        mauza: val.mauza,
        dbfAttributes: val.dbfAttributes,
      });
    }
    inserted++;
  }

  for (let i = 0; i < withoutGeometry.length; i += INSERT_BATCH_SIZE) {
    await db
      .insert(mouzaGisFeatures)
      .values(withoutGeometry.slice(i, i + INSERT_BATCH_SIZE));
  }

  for (let i = 0; i < withGeometry.length; i += INSERT_BATCH_SIZE) {
    const batch = withGeometry.slice(i, i + INSERT_BATCH_SIZE);
    const valueTuples = batch.map(
      (val) => sql`(
        ${val.datasetId}::uuid, ${val.dbfFileId}::uuid, ${val.mCode}, ${val.mauzaJlS},
        ${val.jlNo}, ${val.plotNo}, ${val.mauza}, ${JSON.stringify(val.dbfAttributes)}::jsonb,
        ${geometrySql(val.boundary, sourceEpsg)}
      )`,
    );

    await db.execute(sql`
      INSERT INTO mouza_gis_features (
        dataset_id, dbf_file_id, m_code, mauza_jl_s, jl_no, plot_no, mauza,
        dbf_attributes, boundary
      ) VALUES ${sql.join(valueTuples, sql`, `)}
    `);
  }

  return inserted;
}
