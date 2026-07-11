/**
 * Default visibility rules for imported GIS layers.
 * Point/annotation layers are hidden by default to reduce map clutter.
 */

const HIDDEN_NAME_PATTERNS = [
  /annotation/i,
  /outer_annotation/i,
  /zone_\d+_location/i,
  /location_name/i,
  /locality/i,
];

export function resolveDefaultLayerVisibility(
  layerName: string,
  geometryType: string | null,
): boolean {
  const geom = (geometryType ?? "").toLowerCase();

  if (geom.includes("point")) {
    return !HIDDEN_NAME_PATTERNS.some((pattern) => pattern.test(layerName));
  }

  if (
    geom.includes("polygon") ||
    geom.includes("line") ||
    geom.includes("multipolygon") ||
    geom.includes("multilinestring")
  ) {
    return true;
  }

  return true;
}

/** Apply visibility defaults when DB value was never explicitly set (all false). */
export function resolveLayerVisibility(
  layer: {
    layerName: string;
    geometryType: string | null;
    visible: boolean;
  },
  allLayersHidden: boolean,
): boolean {
  if (allLayersHidden) {
    return resolveDefaultLayerVisibility(layer.layerName, layer.geometryType);
  }
  return layer.visible;
}

export function areAllLayersHidden(
  layers: Array<{ visible: boolean }>,
): boolean {
  return layers.length > 0 && layers.every((layer) => !layer.visible);
}
