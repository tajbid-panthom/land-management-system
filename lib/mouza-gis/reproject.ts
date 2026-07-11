import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Repair geometries that were stored with UTM zone 45N instead of 46N.
 * Converts via projected coordinates: 4326(wrong) -> 32645 -> 32646 -> 4326(correct).
 */
export async function fixWrongUtmZoneGeometries(datasetId?: string) {
  const datasetFilter = datasetId
    ? sql`AND dataset_id = ${datasetId}::uuid`
    : sql``;

  const featureResult = await db.execute(sql`
    UPDATE mouza_gis_features
    SET boundary = ST_Transform(
      ST_SetSRID(ST_Transform(boundary, 32645), 32646),
      4326
    )::geometry(Geometry, 4326)
    WHERE boundary IS NOT NULL
      AND ST_X(ST_Centroid(boundary)) BETWEEN 83 AND 86
      AND ST_Y(ST_Centroid(boundary)) BETWEEN 20 AND 27
      ${datasetFilter}
  `);

  const parcelResult = await db.execute(sql`
    UPDATE land_parcels
    SET boundary = ST_Transform(
      ST_SetSRID(ST_Transform(boundary, 32645), 32646),
      4326
    )::geometry(Geometry, 4326)
    WHERE boundary IS NOT NULL
      AND ST_X(ST_Centroid(boundary)) BETWEEN 83 AND 86
      AND ST_Y(ST_Centroid(boundary)) BETWEEN 20 AND 27
  `);

  const featureCount =
    "rowCount" in featureResult ? featureResult.rowCount : 0;
  const parcelCount =
    "rowCount" in parcelResult ? parcelResult.rowCount : 0;

  return { featureCount, parcelCount };
}
