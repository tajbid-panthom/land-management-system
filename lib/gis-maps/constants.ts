export const GIS_MAP_STATUSES = [
  "queued",
  "uploading",
  "extracting",
  "reading_layers",
  "importing",
  "creating_index",
  "publishing",
  "completed",
  "failed",
] as const;

export type GisMapStatus = (typeof GIS_MAP_STATUSES)[number];

export const SUPPORTED_GIS_FORMATS = [
  "mpk",
  "shp",
  "gdb",
  "gpkg",
  "geojson",
  "json",
  "zip",
] as const;

export type SupportedGisFormat = (typeof SUPPORTED_GIS_FORMATS)[number];

export const SUPPORTED_GIS_EXTENSIONS = new Set(SUPPORTED_GIS_FORMATS);

export function formatLabel(format: string): string {
  return format.toUpperCase();
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
