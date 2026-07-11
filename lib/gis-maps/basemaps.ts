import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "street" | "satellite" | "hybrid";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();

/** OpenFreeMap — free fallback when no MapTiler key is set */
export const STREET_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
    },
  ],
};

export const HYBRID_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
    labels: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "labels", type: "raster", source: "labels" },
  ],
};

export const BASEMAP_OPTIONS: Array<{
  id: BasemapId;
  label: string;
}> = [
  { id: "street", label: "Map" },
  { id: "satellite", label: "Satellite" },
  { id: "hybrid", label: "Hybrid" },
];

const MAPTILER_STYLE_IDS: Record<BasemapId, string> = {
  street: "streets-v2",
  satellite: "satellite",
  hybrid: "hybrid",
};

export function hasMaptilerKey(): boolean {
  return Boolean(MAPTILER_KEY);
}

export function getMaptilerStyleUrl(id: BasemapId): string | null {
  if (!MAPTILER_KEY) return null;
  const styleId = MAPTILER_STYLE_IDS[id];
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_KEY}`;
}

export function getFallbackBasemapStyle(
  id: BasemapId,
): string | StyleSpecification {
  switch (id) {
    case "satellite":
      return SATELLITE_STYLE;
    case "hybrid":
      return HYBRID_STYLE;
    default:
      return STREET_STYLE_URL;
  }
}

export function getBasemapStyle(
  id: BasemapId,
  options?: { preferFallback?: boolean },
): string | StyleSpecification {
  if (!options?.preferFallback) {
    const maptilerUrl = getMaptilerStyleUrl(id);
    if (maptilerUrl) return maptilerUrl;
  }

  return getFallbackBasemapStyle(id);
}

/** Default center: Dhaka, Bangladesh */
export const DEFAULT_VIEW = {
  longitude: 90.4125,
  latitude: 23.8103,
  zoom: 11,
};
