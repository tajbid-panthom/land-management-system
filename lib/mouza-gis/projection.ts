import type { Geometry } from "geojson";

const EPSG_AUTHORITY_RE = /AUTHORITY\["EPSG","(\d+)"\]/i;

/** Parse EPSG code from a .prj WKT string when present. */
export function parseEpsgFromPrj(prj?: string | null): number | null {
  if (!prj) return null;
  const matches = [...prj.matchAll(new RegExp(EPSG_AUTHORITY_RE.source, "gi"))];
  const last = matches.at(-1);
  if (!last) return null;
  const code = Number(last[1]);
  return Number.isFinite(code) ? code : null;
}

function firstCoordinate(geometry: Geometry): [number, number] | null {
  if (geometry.type === "Point") {
    return geometry.coordinates as [number, number];
  }
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0]?.[0] as [number, number] | undefined ?? null;
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates[0]?.[0]?.[0] as [number, number] | undefined ?? null;
  }
  return null;
}

/** Guess source CRS when .prj is missing. */
export function guessSourceEpsg(geometry: Geometry | null): number {
  if (!geometry) return 4326;
  const coord = firstCoordinate(geometry);
  if (!coord) return 4326;
  const [x, y] = coord;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    return 4326;
  }
  // UTM projected coords for Bangladesh (northing > 1M).
  if (y > 1_000_000) {
    // Dhaka and eastern districts use UTM zone 46N, not 45N.
    return 32646;
  }
  return 3106;
}

export function resolveSourceEpsg(
  geometry: Geometry | null,
  prj?: string | null,
): number {
  const fromPrj = parseEpsgFromPrj(prj);
  const guessed = guessSourceEpsg(geometry);

  // Shapefiles often ship with EPSG:32645 in .prj while coordinates are zone 46N.
  if (fromPrj === 32645 && guessed === 32646) {
    return 32646;
  }

  return fromPrj ?? guessed;
}
