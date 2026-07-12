export type MapBBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ViewportQuery = {
  bbox?: MapBBox;
  zoom?: number;
  limit?: number;
};

/** Parse `west,south,east,north` (WGS84). */
export function parseBBoxParam(value: string | null): MapBBox | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  return { west, south, east, north };
}

export function bboxToParam(bbox: MapBBox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

/** Expand bbox slightly so features near edges remain visible while panning. */
export function expandBBox(bbox: MapBBox, factor = 0.15): MapBBox {
  const lngPad = (bbox.east - bbox.west) * factor;
  const latPad = (bbox.north - bbox.south) * factor;
  return {
    west: Math.max(-180, bbox.west - lngPad),
    south: Math.max(-90, bbox.south - latPad),
    east: Math.min(180, bbox.east + lngPad),
    north: Math.min(90, bbox.north + latPad),
  };
}

/**
 * Geometry simplify tolerance in degrees, scaled by zoom.
 * Higher zoom → less simplification for sharper plot edges.
 */
export function simplifyToleranceForZoom(zoom?: number): number {
  if (zoom == null) return 0.000008;
  if (zoom < 8) return 0.001;
  if (zoom < 10) return 0.0003;
  if (zoom < 12) return 0.00008;
  if (zoom < 14) return 0.00002;
  if (zoom < 16) return 0.000008;
  return 0;
}

export function defaultViewportFeatureLimit(zoom?: number): number {
  if (zoom == null) return 2500;
  if (zoom < 10) return 800;
  if (zoom < 12) return 1500;
  if (zoom < 14) return 2500;
  return 4000;
}

/** Stable cache key for a quantized viewport (reduces thrashing while panning). */
export function viewportCacheKey(
  layerId: string,
  bbox: MapBBox,
  zoom: number,
): string {
  const q = (n: number, step: number) => Math.round(n / step) * step;
  const step = zoom < 12 ? 0.05 : zoom < 15 ? 0.02 : 0.01;
  const z = Math.floor(zoom);
  return `${layerId}:${z}:${q(bbox.west, step)},${q(bbox.south, step)},${q(bbox.east, step)},${q(bbox.north, step)}`;
}
