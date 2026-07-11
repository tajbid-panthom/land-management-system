import type { FeatureCollection } from "geojson";
import type { FilterSpecification } from "maplibre-gl";

export type LayerRenderKind = "fill" | "line" | "circle";

export const LAYER_PALETTE = [
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
];

export function getLayerRenderKind(
  geometryType: string | null,
  styleJson?: Record<string, unknown> | null,
): LayerRenderKind {
  const geom = (geometryType ?? "").toLowerCase();
  if (geom.includes("polygon")) return "fill";
  if (geom.includes("line")) return "line";
  if (geom.includes("point")) return "circle";

  const styleType = (styleJson?.type as string | undefined)?.toLowerCase();
  if (styleType === "line" || styleType === "circle" || styleType === "fill") {
    return styleType;
  }

  return "fill";
}

export function buildLayerStyle(
  geometryType: string | null,
  layerIndex: number,
  styleJson?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (styleJson?.type && styleJson?.paint) {
    return styleJson;
  }

  const kind = getLayerRenderKind(geometryType, styleJson);
  const color = LAYER_PALETTE[layerIndex % LAYER_PALETTE.length];

  if (kind === "line") {
    return {
      type: "line",
      paint: {
        "line-color": color,
        "line-width": 2.5,
        "line-opacity": 0.9,
      },
    };
  }

  if (kind === "circle") {
    return {
      type: "circle",
      paint: {
        "circle-color": color,
        "circle-radius": 6,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.9,
      },
    };
  }

  return {
    type: "fill",
    paint: {
      "fill-color": color,
      "fill-opacity": 0.55,
      "fill-outline-color": color,
    },
  };
}

export function getDefaultPaint(
  kind: LayerRenderKind,
  styleJson?: Record<string, unknown> | null,
): Record<string, unknown> {
  const paint = (styleJson?.paint as Record<string, unknown>) ?? {};

  if (kind === "line") {
    return {
      "line-color": "#2563eb",
      "line-width": 2.5,
      "line-opacity": 0.9,
      ...paint,
    };
  }

  if (kind === "circle") {
    return {
      "circle-color": "#dc2626",
      "circle-radius": 6,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.9,
      ...paint,
    };
  }

  return {
    "fill-color": "#dc2626",
    "fill-opacity": 0.55,
    "fill-outline-color": "#b91c1c",
    ...paint,
  };
}

export const POLYGON_GEOMETRY_FILTER: FilterSpecification = [
  "match",
  ["geometry-type"],
  "Polygon",
  true,
  "MultiPolygon",
  true,
  false,
];

export function getInteractiveLayerIds(
  layers: Array<{
    id: string;
    geometryType: string | null;
    visible: boolean;
    styleJson?: Record<string, unknown> | null;
  }>,
): string[] {
  return layers
    .filter((l) => l.visible)
    .flatMap((l) => {
      const kind = getLayerRenderKind(l.geometryType, l.styleJson);
      if (kind === "line") return [`${l.id}-line`];
      if (kind === "circle") return [`${l.id}-circle`];
      return [`${l.id}-fill`, `${l.id}-outline`];
    });
}

export function computeBounds(
  collections: FeatureCollection[],
): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords as [number, number];
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    for (const c of coords) visit(c);
  };

  for (const collection of collections) {
    for (const feature of collection.features ?? []) {
      if (feature.geometry && "coordinates" in feature.geometry) {
        visit(feature.geometry.coordinates);
      }
    }
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function isPolygonLayer(geometryType: string | null): boolean {
  return (geometryType ?? "").toLowerCase().includes("polygon");
}
