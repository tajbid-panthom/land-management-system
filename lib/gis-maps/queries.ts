import { db } from "@/lib/db";
import {
  gisMaps,
  gisLayers,
  gisLayerFeatures,
  gisProcessingJobs,
  users,
} from "@/lib/db/schema";
import { desc, eq, sql, and, ilike, or } from "drizzle-orm";
import { deleteMapFiles } from "./storage";

export async function listMaps(limit = 50) {
  return db
    .select({
      id: gisMaps.id,
      name: gisMaps.name,
      slug: gisMaps.slug,
      status: gisMaps.status,
      fileFormat: gisMaps.fileFormat,
      fileSizeBytes: gisMaps.fileSizeBytes,
      originalFileName: gisMaps.originalFileName,
      uploadedBy: gisMaps.uploadedBy,
      uploaderName: users.name,
      uploaderEmail: users.email,
      layerCount: sql<number>`(
        SELECT COUNT(*)::int FROM gis_layers WHERE map_id = ${gisMaps.id}
      )`,
      createdAt: gisMaps.createdAt,
      updatedAt: gisMaps.updatedAt,
      errorMessage: gisMaps.errorMessage,
    })
    .from(gisMaps)
    .leftJoin(users, eq(gisMaps.uploadedBy, users.id))
    .orderBy(desc(gisMaps.createdAt))
    .limit(limit);
}

export async function getMapById(mapId: string) {
  const [map] = await db
    .select()
    .from(gisMaps)
    .where(eq(gisMaps.id, mapId))
    .limit(1);
  return map ?? null;
}

export async function getMapLayers(mapId: string) {
  return db
    .select()
    .from(gisLayers)
    .where(eq(gisLayers.mapId, mapId))
    .orderBy(gisLayers.sortOrder, gisLayers.layerName);
}

export async function getJobById(jobId: string) {
  const [job] = await db
    .select()
    .from(gisProcessingJobs)
    .where(eq(gisProcessingJobs.id, jobId))
    .limit(1);
  return job ?? null;
}

export async function listJobs(limit = 50) {
  return db
    .select({
      id: gisProcessingJobs.id,
      mapId: gisProcessingJobs.mapId,
      mapName: gisMaps.name,
      status: gisProcessingJobs.status,
      progress: gisProcessingJobs.progress,
      message: gisProcessingJobs.message,
      errorMessage: gisProcessingJobs.errorMessage,
      startedAt: gisProcessingJobs.startedAt,
      completedAt: gisProcessingJobs.completedAt,
      createdAt: gisProcessingJobs.createdAt,
    })
    .from(gisProcessingJobs)
    .leftJoin(gisMaps, eq(gisProcessingJobs.mapId, gisMaps.id))
    .orderBy(desc(gisProcessingJobs.createdAt))
    .limit(limit);
}

export async function getLatestJobForMap(mapId: string) {
  const [job] = await db
    .select()
    .from(gisProcessingJobs)
    .where(eq(gisProcessingJobs.mapId, mapId))
    .orderBy(desc(gisProcessingJobs.createdAt))
    .limit(1);
  return job ?? null;
}

export async function getLayerGeoJson(layerId: string, limit = 10000) {
  const stats = await db.execute<{
    total: number;
    with_geom: number;
    valid_geom: number;
    srid: number | null;
    geom_types: string | null;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE geom IS NOT NULL)::int AS with_geom,
      COUNT(*) FILTER (WHERE geom IS NOT NULL AND ST_IsValid(geom))::int AS valid_geom,
      MAX(ST_SRID(geom)) FILTER (WHERE geom IS NOT NULL) AS srid,
      string_agg(DISTINCT GeometryType(geom), ', ' ORDER BY GeometryType(geom))
        FILTER (WHERE geom IS NOT NULL) AS geom_types
    FROM gis_layer_features
    WHERE layer_id = ${layerId}
  `);

  const rows = await db.execute<{
    type: string;
    features: unknown;
    feature_count: number;
  }>(sql`
    SELECT
      'FeatureCollection' AS type,
      COALESCE(
        json_agg(
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(
              CASE
                WHEN GeometryType(f.geom) IN ('POLYGON', 'MULTIPOLYGON')
                THEN ST_SimplifyPreserveTopology(f.geom, 0.000008)
                ELSE f.geom
              END
            )::json,
            'properties', f.properties
          )
        ) FILTER (WHERE f.geom IS NOT NULL AND ST_IsValid(f.geom)),
        '[]'::json
      ) AS features,
      COUNT(*)::int AS feature_count
    FROM (
      SELECT geom, properties
      FROM gis_layer_features
      WHERE layer_id = ${layerId}
        AND geom IS NOT NULL
        AND ST_IsValid(geom)
      ORDER BY id
      LIMIT ${limit}
    ) f
  `);

  const row = rows.rows[0];
  const statRow = stats.rows[0];
  const features = (row?.features as unknown[]) ?? [];

  return {
    type: "FeatureCollection",
    features,
    meta: {
      returned: features.length,
      total: statRow?.total ?? row?.feature_count ?? 0,
      withGeometry: statRow?.with_geom ?? 0,
      validGeometry: statRow?.valid_geom ?? 0,
      srid: statRow?.srid ?? null,
      geometryTypes: statRow?.geom_types ?? null,
    },
  };
}

export async function getFeatureById(featureId: string) {
  const rows = await db.execute<{
    id: string;
    layer_id: string;
    layer_name: string;
    geometry_type: string;
    properties: Record<string, unknown>;
    geojson: string;
    area: number | null;
  }>(sql`
    SELECT
      f.id,
      f.layer_id,
      l.layer_name,
      l.geometry_type,
      f.properties,
      ST_AsGeoJSON(f.geom) AS geojson,
      CASE
        WHEN GeometryType(f.geom) IN ('POLYGON', 'MULTIPOLYGON')
        THEN ST_Area(f.geom::geography)
        ELSE NULL
      END AS area
    FROM gis_layer_features f
    JOIN gis_layers l ON l.id = f.layer_id
    WHERE f.id = ${featureId}
    LIMIT 1
  `);

  return rows.rows[0] ?? null;
}

export async function searchMapFeatures(
  query: string,
  mapId?: string,
  layerFilter?: string,
) {
  const pattern = `%${query}%`;

  const conditions = [
    or(
      sql`f.properties::text ILIKE ${pattern}`,
      ilike(gisLayers.layerName, pattern),
    ),
  ];

  if (mapId) {
    conditions.push(eq(gisLayers.mapId, mapId));
  }
  if (layerFilter) {
    conditions.push(ilike(gisLayers.layerName, `%${layerFilter}%`));
  }

  const rows = await db
    .select({
      featureId: gisLayerFeatures.id,
      layerId: gisLayers.id,
      layerName: gisLayers.layerName,
      mapId: gisLayers.mapId,
      properties: gisLayerFeatures.properties,
      centroid: sql<string>`ST_AsGeoJSON(ST_Centroid(${gisLayerFeatures.geom}))`,
    })
    .from(gisLayerFeatures)
    .innerJoin(gisLayers, eq(gisLayerFeatures.layerId, gisLayers.id))
    .where(and(...conditions))
    .limit(25);

  return rows;
}

export async function deleteMap(mapId: string) {
  await deleteMapFiles(mapId);
  await db.delete(gisMaps).where(eq(gisMaps.id, mapId));
}

export async function updateLayer(
  layerId: string,
  data: Partial<{
    visible: boolean;
    styleJson: Record<string, unknown>;
    layerName: string;
  }>,
) {
  const [updated] = await db
    .update(gisLayers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(gisLayers.id, layerId))
    .returning();
  return updated ?? null;
}
