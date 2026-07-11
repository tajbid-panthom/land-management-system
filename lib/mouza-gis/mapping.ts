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

export type MappingResult = {
  matched: number;
  unmatchedRecords: number;
  unmatchedFeatures: number;
  duplicatesSkipped: number;
  errors: string[];
};

type MatchKey = {
  mCode: string;
  plotNo: string | null;
  mauzaJlS: string | null;
};

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

export async function mapDatasetRecords(
  datasetId: string,
): Promise<MappingResult> {
  const result: MappingResult = {
    matched: 0,
    unmatchedRecords: 0,
    unmatchedFeatures: 0,
    duplicatesSkipped: 0,
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
    result.errors.push("No active DBF file found for this dataset");
    return result;
  }

  const records = await db
    .select()
    .from(mouzaGisRecords)
    .where(eq(mouzaGisRecords.datasetId, datasetId));

  const features = await db
    .select()
    .from(mouzaGisFeatures)
    .where(eq(mouzaGisFeatures.datasetId, datasetId));

  const featureMap = new Map<string, (typeof features)[0]>();
  const usedFeatures = new Set<string>();

  for (const feature of features) {
    const key = buildMatchKey(feature.mCode, feature.plotNo, feature.mauzaJlS);
    if (key && !featureMap.has(key)) {
      featureMap.set(key, feature);
    }
  }

  for (const record of records) {
    const primaryKey = buildMatchKey(record.mCode, record.plotNo, record.mauzaJlS);
    const fallbackKey = buildMatchKey(record.mCode, null, record.mauzaJlS);
    const jlKey =
      record.jlNo && record.plotNo
        ? `${record.jlNo}::${record.plotNo}`
        : null;

    let feature =
      (primaryKey && featureMap.get(primaryKey)) ||
      (fallbackKey && featureMap.get(fallbackKey)) ||
      (jlKey && featureMap.get(jlKey)) ||
      null;

    if (!feature) {
      result.unmatchedRecords++;
      continue;
    }

    if (usedFeatures.has(feature.id)) {
      result.duplicatesSkipped++;
      continue;
    }
    usedFeatures.add(feature.id);

    try {
      const mouzaId = await upsertMouzaFromRecord(record, datasetId);
      const parcelId = await upsertParcelFromRecord(record, mouzaId, feature);

      await db
        .update(mouzaGisRecords)
        .set({
          mouzaId,
          parcelId,
          featureId: feature.id,
          mappedAt: new Date(),
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

      result.matched++;
    } catch (err) {
      result.errors.push(
        `Record ${record.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  result.unmatchedFeatures = features.length - usedFeatures.size;
  return result;
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
): Promise<string> {
  if (record.mouzaId) return record.mouzaId;

  const upazilaId = await findUpazilaId(record.mUpazila, record.mDistrict);

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
        mCode: record.mCode,
        datasetId,
        upazilaId: upazilaId ?? undefined,
      })
      .where(eq(mouzas.id, existing[0].id));
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

  return created.id;
}

async function upsertParcelFromRecord(
  record: typeof mouzaGisRecords.$inferSelect,
  mouzaId: string,
  feature: typeof mouzaGisFeatures.$inferSelect,
): Promise<string> {
  if (record.parcelId) return record.parcelId;

  const plotNumber = record.plotNo ?? "unknown";
  const areaValue = record.mAcres ?? record.shapeArea ?? "0";

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

  const wkt = feature.boundary
    ? null
    : null; // boundary set via raw SQL if needed

  if (existing[0]) {
    await db
      .update(landParcels)
      .set({
        areaValue,
        areaUnit: "acre",
        updatedAt: new Date(),
      })
      .where(eq(landParcels.id, existing[0].id));
    return existing[0].id;
  }

  const [created] = await db
    .insert(landParcels)
    .values({
      mouzaId,
      plotNumber,
      areaValue,
      areaUnit: "acre",
      status: "active",
    })
    .returning({ id: landParcels.id });

  return created.id;
}

export async function insertFeaturesFromParsed(
  datasetId: string,
  dbfFileId: string,
  parsedFeatures: ParsedFeature[],
): Promise<number> {
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < parsedFeatures.length; i += BATCH_SIZE) {
    const batch = parsedFeatures.slice(i, i + BATCH_SIZE);
    const values = batch.map((f) => ({
      datasetId,
      dbfFileId,
      mCode: f.matchKeys.mCode,
      mauzaJlS: f.matchKeys.mauzaJlS,
      jlNo: f.matchKeys.jlNo,
      plotNo: f.matchKeys.plotNo,
      mauza: f.matchKeys.mauza,
      dbfAttributes: f.attributes,
      boundary: f.geometry ? geometryToWkt(f.geometry) : null,
    }));

    for (const val of values) {
      if (val.boundary) {
        await db.execute(sql`
          INSERT INTO mouza_gis_features (
            dataset_id, dbf_file_id, m_code, mauza_jl_s, jl_no, plot_no, mauza,
            dbf_attributes, boundary
          ) VALUES (
            ${val.datasetId}, ${val.dbfFileId}, ${val.mCode}, ${val.mauzaJlS},
            ${val.jlNo}, ${val.plotNo}, ${val.mauza}, ${JSON.stringify(val.dbfAttributes)}::jsonb,
            ST_SetSRID(ST_GeomFromText(${val.boundary}), 4326)
          )
        `);
      } else {
        await db.insert(mouzaGisFeatures).values({
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
  }

  return inserted;
}
