const TILESERV_URL = process.env.PG_TILESERV_URL?.replace(/\/$/, "");

export function isTileServerConfigured(): boolean {
  return Boolean(TILESERV_URL);
}

/** pg_tileserv layer URL for a published view/function layer */
export function getVectorTileUrl(layerTableName: string): string | null {
  if (!TILESERV_URL) return null;
  return `${TILESERV_URL}/${layerTableName}/{z}/{x}/{y}.pbf`;
}

export function getTileServerBaseUrl(): string | null {
  return TILESERV_URL ?? null;
}

/**
 * SQL to create a pg_tileserv-compatible view per layer.
 * Run manually or via migration when pg_tileserv is deployed.
 */
export function layerViewSql(layerId: string, viewName: string): string {
  return `
CREATE OR REPLACE VIEW ${viewName} AS
SELECT
  f.id,
  f.properties,
  f.geom
FROM gis_layer_features f
WHERE f.layer_id = '${layerId}'::uuid
  AND f.geom IS NOT NULL;
`.trim();
}
