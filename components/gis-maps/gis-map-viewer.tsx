"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import MapGL, {
  Layer,
  Source,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  type MapRef,
} from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BASEMAP_OPTIONS,
  DEFAULT_VIEW,
  getBasemapStyle,
  hasMaptilerKey,
  type BasemapId,
} from "@/lib/gis-maps/basemaps";
import {
  buildLayerStyle,
  computeBounds,
  getDefaultPaint,
  getInteractiveLayerIds,
  getLayerRenderKind,
  isPolygonLayer,
  POLYGON_GEOMETRY_FILTER,
} from "@/lib/gis-maps/layer-render";
import {
  logLayerLoadResult,
  mapWithConcurrency,
  resetLayerLoadLogs,
  summarizeGeoJson,
} from "@/lib/gis-maps/layer-debug";
import {
  buildGisLayerPopupSections,
  buildMouzaPopupSections,
  buildPropertyDocumentActions,
  formatCoordinates,
  getGeometryAnchor,
  type MouzaPopupDetail,
  type PropertyDocumentAction,
} from "@/lib/gis-maps/feature-popup";
import { buildPropertyPopupLinks } from "@/lib/gis-maps/property-links";
import {
  bboxToParam,
  expandBBox,
  type MapBBox,
  viewportCacheKey,
} from "@/lib/gis-maps/viewport";
import { MapFeaturePopup } from "@/components/gis-maps/map-feature-popup";
import { MapPdfViewer } from "@/components/gis-maps/map-pdf-viewer";

type LayerMeta = {
  id: string;
  layerName: string;
  geometryType: string | null;
  featureCount: number | null;
  visible: boolean;
  styleJson: Record<string, unknown> | null;
};

type LayerLoadState = "idle" | "loading" | "ready" | "error";

type GisMapViewerProps = {
  mapId?: string;
  className?: string;
  /** Deep-link from property search: open this mouza plot after load. */
  focusPlot?: {
    mouzaId?: string;
    plotNo?: string;
    datasetId?: string;
    featureId?: string;
    mauza?: string;
  };
};

type MouzaSearchHit = {
  recordId: string;
  mouzaId: string | null;
  mauza: string;
  mCode: string;
  jlNo: string;
  plotNo: string | null;
  mDistrict: string | null;
  mUpazila: string | null;
  syncStatus: string | null;
  centroid: string | null;
};

type MouzaDetail = MouzaPopupDetail;

type PopupState =
  | {
      kind: "mouza";
      detail: MouzaDetail;
      anchor: { lng: number; lat: number };
    }
  | {
      kind: "gis";
      layerName: string;
      geometryType: string;
      properties: Record<string, unknown>;
      featureId?: string | null;
      anchor: { lng: number; lat: number };
    }
  | null;

type PdfViewerState = {
  title: string;
  fileName: string;
  url: string | null;
  loading: boolean;
  error: string | null;
} | null;

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function readMapBBox(map: {
  getBounds: () => {
    getWest: () => number;
    getSouth: () => number;
    getEast: () => number;
    getNorth: () => number;
  };
}): MapBBox {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

export function GisMapViewer({
  mapId,
  className,
  focusPlot,
}: GisMapViewerProps) {
  const mapRef = useRef<MapRef>(null);
  const viewportCacheRef = useRef<Map<string, FeatureCollection>>(new Map());
  const loadGenerationRef = useRef(0);
  const moveTimerRef = useRef<number | null>(null);

  const [maps, setMaps] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedMapId, setSelectedMapId] = useState(mapId ?? "");
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [layerData, setLayerData] = useState<Record<string, FeatureCollection>>(
    {},
  );
  const [layerStatus, setLayerStatus] = useState<Record<string, LayerLoadState>>(
    {},
  );
  const [layerErrors, setLayerErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      featureId: string;
      layerName: string;
      properties: Record<string, unknown>;
      centroid: string;
    }>
  >([]);
  const [mouzaSearchResults, setMouzaSearchResults] = useState<MouzaSearchHit[]>(
    [],
  );
  const [mouzaGeojson, setMouzaGeojson] = useState<FeatureCollection | null>(
    null,
  );
  const [mouzaStatus, setMouzaStatus] = useState<LayerLoadState>("idle");
  const [mouzaError, setMouzaError] = useState<string | null>(null);
  const [mouzaDatasetId, setMouzaDatasetId] = useState(
    focusPlot?.datasetId ?? "",
  );
  const [showMouzaLayer, setShowMouzaLayer] = useState(true);
  const [popup, setPopup] = useState<PopupState>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{
    popup: { x: number; y: number };
  } | null>(null);
  const [pdfViewer, setPdfViewer] = useState<PdfViewerState>(null);
  const [highlightPlot, setHighlightPlot] = useState<string | null>(
    focusPlot?.plotNo ?? null,
  );
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [basemap, setBasemap] = useState<BasemapId>("street");
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(
    null,
  );
  const [zoom, setZoom] = useState(DEFAULT_VIEW.zoom);
  const [maptilerOk, setMaptilerOk] = useState<boolean | null>(
    hasMaptilerKey() ? null : false,
  );
  const [basemapWarning, setBasemapWarning] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layersMetaLoading, setLayersMetaLoading] = useState(false);

  const layersRef = useRef(layers);
  layersRef.current = layers;

  const mapStyle = useMemo(
    () =>
      getBasemapStyle(basemap, {
        preferFallback: maptilerOk === false,
      }),
    [basemap, maptilerOk],
  ) as string | StyleSpecification;

  const fetchLayerGeoJson = useCallback(
    async (
      layer: Pick<LayerMeta, "id" | "layerName" | "geometryType">,
      bbox: MapBBox,
      currentZoom: number,
    ) => {
      const expanded = expandBBox(bbox);
      const cacheKey = viewportCacheKey(layer.id, expanded, currentZoom);
      const cached = viewportCacheRef.current.get(cacheKey);
      if (cached) return cached;

      const params = new URLSearchParams({
        bbox: bboxToParam(expanded),
        zoom: String(currentZoom),
      });
      const geoRes = await fetch(`/api/maps/layers/${layer.id}?${params}`);
      const empty = emptyCollection();

      if (!geoRes.ok) {
        logLayerLoadResult(
          summarizeGeoJson(
            layer.id,
            layer.layerName,
            layer.geometryType,
            empty,
            geoRes.status,
          ),
        );
        throw new Error(`Failed to load layer (${geoRes.status})`);
      }

      const geo = (await geoRes.json()) as FeatureCollection & {
        features?: FeatureCollection["features"];
        meta?: {
          total?: number;
          validGeometry?: number;
          srid?: number | null;
          geometryTypes?: string | null;
        };
      };
      const collection = {
        type: "FeatureCollection",
        features: geo.features ?? [],
      } as FeatureCollection;

      const result = summarizeGeoJson(
        layer.id,
        layer.layerName,
        layer.geometryType,
        collection,
      );
      if (
        result.featureCount === 0 &&
        geo.meta?.total &&
        geo.meta.total > 0
      ) {
        result.error = `No features in viewport (${geo.meta.total} total in layer)`;
      }
      logLayerLoadResult(result);

      if (viewportCacheRef.current.size > 48) {
        const firstKey = viewportCacheRef.current.keys().next().value;
        if (firstKey) viewportCacheRef.current.delete(firstKey);
      }
      viewportCacheRef.current.set(cacheKey, collection);
      return collection;
    },
    [],
  );

  const loadVisibleLayersForViewport = useCallback(
    async (bbox: MapBBox, currentZoom: number, generation: number) => {
      const targets = layersRef.current.filter((layer) => layer.visible);
      if (targets.length === 0) return;

      setLayerStatus((prev) => {
        const next = { ...prev };
        for (const layer of targets) next[layer.id] = "loading";
        return next;
      });

      await mapWithConcurrency(targets, 3, async (layer) => {
        try {
          const geo = await fetchLayerGeoJson(layer, bbox, currentZoom);
          if (generation !== loadGenerationRef.current) return;
          setLayerData((prev) => ({ ...prev, [layer.id]: geo }));
          setLayerStatus((prev) => ({ ...prev, [layer.id]: "ready" }));
          setLayerErrors((prev) => {
            const next = { ...prev };
            delete next[layer.id];
            return next;
          });
        } catch (error) {
          if (generation !== loadGenerationRef.current) return;
          setLayerStatus((prev) => ({ ...prev, [layer.id]: "error" }));
          setLayerErrors((prev) => ({
            ...prev,
            [layer.id]:
              error instanceof Error ? error.message : "Layer failed to load",
          }));
        }
      });
    },
    [fetchLayerGeoJson],
  );

  const loadMouzaForViewport = useCallback(
    async (bbox: MapBBox, currentZoom: number, generation: number) => {
      if (!mouzaDatasetId || !showMouzaLayer) {
        setMouzaGeojson(null);
        setMouzaStatus("idle");
        return;
      }

      setMouzaStatus("loading");
      setMouzaError(null);

      const expanded = expandBBox(bbox);
      const cacheKey = viewportCacheKey(
        `mouza:${mouzaDatasetId}`,
        expanded,
        currentZoom,
      );
      const cached = viewportCacheRef.current.get(cacheKey);
      if (cached) {
        if (generation === loadGenerationRef.current) {
          setMouzaGeojson(cached);
          setMouzaStatus("ready");
        }
        return;
      }

      try {
        const params = new URLSearchParams({
          level: "synced-geojson",
          datasetId: mouzaDatasetId,
          bbox: bboxToParam(expanded),
          zoom: String(currentZoom),
        });
        const res = await fetch(`/api/mouza-gis/search?${params}`);
        if (!res.ok) throw new Error(`Mouza layer failed (${res.status})`);
        const geo = (await res.json()) as FeatureCollection;
        const collection = {
          type: "FeatureCollection",
          features: geo.features ?? [],
        } as FeatureCollection;
        viewportCacheRef.current.set(cacheKey, collection);
        if (generation !== loadGenerationRef.current) return;
        setMouzaGeojson(collection);
        setMouzaStatus("ready");
      } catch (error) {
        if (generation !== loadGenerationRef.current) return;
        setMouzaStatus("error");
        setMouzaError(
          error instanceof Error ? error.message : "Mouza layer failed",
        );
      }
    },
    [mouzaDatasetId, showMouzaLayer],
  );

  const refreshViewport = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const generation = ++loadGenerationRef.current;
    const bbox = readMapBBox(map);
    const currentZoom = map.getZoom();
    void loadVisibleLayersForViewport(bbox, currentZoom, generation);
    void loadMouzaForViewport(bbox, currentZoom, generation);
  }, [loadMouzaForViewport, loadVisibleLayersForViewport]);

  const scheduleViewportRefresh = useCallback(() => {
    if (moveTimerRef.current != null) {
      window.clearTimeout(moveTimerRef.current);
    }
    moveTimerRef.current = window.setTimeout(() => {
      refreshViewport();
    }, 280);
  }, [refreshViewport]);

  useEffect(() => {
    if (!hasMaptilerKey()) return;

    fetch("/api/maps/basemap-check")
      .then((r) => r.json())
      .then((data: { ok?: boolean; message?: string }) => {
        setMaptilerOk(Boolean(data.ok));
        if (!data.ok && data.message) {
          setBasemapWarning(data.message);
        }
      })
      .catch(() => {
        setMaptilerOk(false);
        setBasemapWarning(
          "Could not verify MapTiler key. Using free basemap.",
        );
      });
  }, []);

  useEffect(() => {
    fetch("/api/maps")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.maps ?? []).map(
          (m: { id: string; name: string }) => ({
            id: m.id,
            name: m.name,
          }),
        );
        setMaps(list);
        setSelectedMapId((current) => current || list[0]?.id || "");
      })
      .catch(() => undefined);

    fetch("/api/mouza-gis/datasets")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.datasets ?? []).map(
          (d: { id: string; name: string }) => ({
            id: d.id,
            name: d.name,
          }),
        );
        setDatasets(list);
        setMouzaDatasetId(
          (current) => current || focusPlot?.datasetId || list[0]?.id || "",
        );
      })
      .catch(() => undefined);
  }, [focusPlot?.datasetId]);

  useEffect(() => {
    if (!selectedMapId) {
      setLayers([]);
      setLayerData({});
      return;
    }

    let cancelled = false;
    setLayersMetaLoading(true);
    resetLayerLoadLogs();
    viewportCacheRef.current.clear();

    fetch(`/api/maps/layers?mapId=${selectedMapId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const layerList = (data.layers ?? []) as LayerMeta[];
        setLayers(layerList);
        setLayerStatus(
          Object.fromEntries(
            layerList.map((layer) => [
              layer.id,
              layer.visible ? "loading" : "idle",
            ]),
          ),
        );
        setLayerData({});
        setLayerErrors({});
      })
      .catch(() => {
        if (!cancelled) setLayers([]);
      })
      .finally(() => {
        if (!cancelled) setLayersMetaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMapId]);

  useEffect(() => {
    if (!mapReady) return;
    refreshViewport();
  }, [mapReady, layers, mouzaDatasetId, showMouzaLayer, refreshViewport]);

  useEffect(() => {
    if (!mapReady || !focusPlot?.mouzaId || !focusPlot.plotNo) return;
    if (focusPlot.featureId) return;

    let cancelled = false;
    const params = new URLSearchParams({
      level: "detail",
      mouzaId: focusPlot.mouzaId,
      plotNo: focusPlot.plotNo,
    });

    fetch(`/api/mouza-gis/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.detail) return;
        const detail = data.detail as MouzaDetail;
        setHighlightPlot(focusPlot.plotNo ?? null);

        let anchor =
          detail.geometry != null
            ? getGeometryAnchor(detail.geometry)
            : null;

        if (!anchor && detail.coordinates) {
          const match = detail.coordinates.match(
            /(-?\d+\.?\d*)°,\s*(-?\d+\.?\d*)°/,
          );
          if (match) {
            anchor = {
              lat: Number(match[1]),
              lng: Number(match[2]),
            };
          }
        }
        if (!anchor) return;

        mapRef.current?.flyTo({
          center: [anchor.lng, anchor.lat],
          zoom: 16,
          duration: 1000,
        });
        setPopup({ kind: "mouza", detail, anchor });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mapReady, focusPlot?.mouzaId, focusPlot?.plotNo, focusPlot?.featureId]);

  useEffect(() => {
    if (!mapReady || !focusPlot?.featureId) return;

    let cancelled = false;
    const params = new URLSearchParams({
      featureId: focusPlot.featureId,
    });
    if (focusPlot.plotNo) params.set("plotNo", focusPlot.plotNo);
    if (focusPlot.mauza) params.set("mauza", focusPlot.mauza);

    fetch(`/api/maps/resolve-property?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.detail) return;
        const detail = data.detail as MouzaDetail;
        setHighlightPlot(detail.plotNo ?? focusPlot.plotNo ?? null);

        let anchor: { lng: number; lat: number } | null = null;
        if (data.anchor?.lng != null && data.anchor?.lat != null) {
          anchor = { lng: data.anchor.lng, lat: data.anchor.lat };
        } else if (detail.coordinates) {
          const match = detail.coordinates.match(
            /(-?\d+\.?\d*)°,\s*(-?\d+\.?\d*)°/,
          );
          if (match) {
            anchor = {
              lat: Number(match[1]),
              lng: Number(match[2]),
            };
          }
        }
        if (!anchor) return;

        mapRef.current?.flyTo({
          center: [anchor.lng, anchor.lat],
          zoom: 16,
          duration: 1000,
        });
        setPopup({ kind: "mouza", detail, anchor });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    focusPlot?.featureId,
    focusPlot?.plotNo,
    focusPlot?.mauza,
  ]);

  const fitToData = useCallback(
    (data: Record<string, FeatureCollection>, visibleOnly = true) => {
      const currentLayers = layersRef.current;
      const collections = visibleOnly
        ? currentLayers
            .filter((layer) => layer.visible)
            .map((layer) => data[layer.id])
            .filter((collection): collection is FeatureCollection =>
              Boolean(collection?.features?.length),
            )
        : Object.values(data).filter(
            (collection) => collection.features?.length,
          );

      if (mouzaGeojson?.features?.length) {
        collections.push(mouzaGeojson);
      }

      const bounds = computeBounds(collections);
      if (!bounds || !mapRef.current) return;
      mapRef.current.fitBounds(bounds, {
        padding: 48,
        duration: 1200,
        maxZoom: 16,
      });
    },
    [mouzaGeojson],
  );

  const toggleLayer = async (layer: LayerMeta) => {
    const nextVisible = !layer.visible;

    const res = await fetch("/api/maps/layers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layerId: layer.id, visible: nextVisible }),
    });

    if (!res.ok) return;

    setLayers((prev) =>
      prev.map((l) =>
        l.id === layer.id ? { ...l, visible: nextVisible } : l,
      ),
    );

    if (!nextVisible) {
      setLayerStatus((prev) => ({ ...prev, [layer.id]: "idle" }));
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map) return;
    const generation = ++loadGenerationRef.current;
    setLayerStatus((prev) => ({ ...prev, [layer.id]: "loading" }));
    try {
      const geo = await fetchLayerGeoJson(
        layer,
        readMapBBox(map),
        map.getZoom(),
      );
      if (generation !== loadGenerationRef.current) return;
      setLayerData((prev) => ({ ...prev, [layer.id]: geo }));
      setLayerStatus((prev) => ({ ...prev, [layer.id]: "ready" }));
    } catch (error) {
      setLayerStatus((prev) => ({ ...prev, [layer.id]: "error" }));
      setLayerErrors((prev) => ({
        ...prev,
        [layer.id]:
          error instanceof Error ? error.message : "Layer failed to load",
      }));
    }
  };

  const retryLayer = async (layer: LayerMeta) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setLayerStatus((prev) => ({ ...prev, [layer.id]: "loading" }));
    try {
      const geo = await fetchLayerGeoJson(
        layer,
        readMapBBox(map),
        map.getZoom(),
      );
      setLayerData((prev) => ({ ...prev, [layer.id]: geo }));
      setLayerStatus((prev) => ({ ...prev, [layer.id]: "ready" }));
      setLayerErrors((prev) => {
        const next = { ...prev };
        delete next[layer.id];
        return next;
      });
    } catch (error) {
      setLayerStatus((prev) => ({ ...prev, [layer.id]: "error" }));
      setLayerErrors((prev) => ({
        ...prev,
        [layer.id]:
          error instanceof Error ? error.message : "Layer failed to load",
      }));
    }
  };

  const showPolygonLayers = async () => {
    const polygonLayers = layers.filter((layer) =>
      isPolygonLayer(layer.geometryType),
    );
    if (polygonLayers.length === 0) return;

    setLayers((prev) =>
      prev.map((layer) =>
        isPolygonLayer(layer.geometryType)
          ? { ...layer, visible: true }
          : layer,
      ),
    );

    await Promise.all(
      polygonLayers.map((layer) =>
        fetch("/api/maps/layers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layerId: layer.id, visible: true }),
        }),
      ),
    );

    refreshViewport();
  };

  const runSearch = async () => {
    if (!search.trim()) return;
    const params = new URLSearchParams({ q: search.trim() });
    if (selectedMapId) params.set("mapId", selectedMapId);

    const mouzaParams = new URLSearchParams({
      level: "search",
      q: search.trim(),
    });
    if (mouzaDatasetId) mouzaParams.set("datasetId", mouzaDatasetId);

    const [mapRes, mouzaRes] = await Promise.all([
      fetch(`/api/maps/search?${params}`),
      fetch(`/api/mouza-gis/search?${mouzaParams}`),
    ]);

    const mapData = await mapRes.json();
    const mouzaData = await mouzaRes.json();
    setSearchResults(mapData.results ?? []);
    setMouzaSearchResults(mouzaData.results ?? []);
  };

  const closePopup = useCallback(() => {
    setPopup(null);
    setPopupLoading(false);
    setHighlightPlot(null);
    setPdfViewer(null);
  }, []);

  const closePdfViewer = useCallback(() => {
    setPdfViewer(null);
  }, []);

  const loadMouzaDetail = useCallback(
    async (
      mouzaId: string,
      plotNo: string | null,
      anchor: { lng: number; lat: number },
      fallback: MouzaDetail,
    ) => {
      setPopupLoading(true);
      setPdfViewer(null);
      setPopup({
        kind: "mouza",
        detail: {
          ...fallback,
          coordinates: formatCoordinates(anchor.lat, anchor.lng),
        },
        anchor,
      });

      const params = new URLSearchParams({ level: "detail", mouzaId });
      if (plotNo) params.set("plotNo", plotNo);
      const res = await fetch(`/api/mouza-gis/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.detail) {
          setPopup({
            kind: "mouza",
            detail: {
              ...(data.detail as MouzaDetail),
              coordinates:
                (data.detail as MouzaDetail).coordinates ??
                formatCoordinates(anchor.lat, anchor.lng),
            },
            anchor,
          });
        }
      }
      setPopupLoading(false);
    },
    [],
  );

  const zoomToMouzaResult = async (hit: MouzaSearchHit) => {
    let anchor: { lng: number; lat: number } | null = null;
    if (hit.centroid) {
      try {
        const geom = JSON.parse(hit.centroid) as {
          coordinates: [number, number];
        };
        anchor = { lng: geom.coordinates[0], lat: geom.coordinates[1] };
        mapRef.current?.flyTo({
          center: geom.coordinates,
          zoom: 15,
          duration: 1000,
        });
      } catch {
        /* ignore */
      }
    }

    setHighlightPlot(hit.plotNo);

    const fallback: MouzaDetail = {
      mauza: hit.mauza,
      mCode: hit.mCode,
      jlNo: hit.jlNo,
      plotNo: hit.plotNo,
      sheetNo: null,
      revenueNo: null,
      project: null,
      mDistrict: hit.mDistrict,
      mUpazila: hit.mUpazila,
      landType: null,
      landClass: null,
      mAcres: null,
      syncStatus: hit.syncStatus,
    };

    if (hit.mouzaId && anchor) {
      await loadMouzaDetail(hit.mouzaId, hit.plotNo, anchor, fallback);
      return;
    }

    if (anchor) {
      setPopup({
        kind: "mouza",
        detail: {
          ...fallback,
          coordinates: formatCoordinates(anchor.lat, anchor.lng),
        },
        anchor,
      });
    }
  };

  const zoomToResult = (centroidJson: string) => {
    try {
      const geom = JSON.parse(centroidJson) as {
        coordinates: [number, number];
      };
      mapRef.current?.flyTo({
        center: geom.coordinates,
        zoom: 15,
        duration: 1000,
      });
    } catch {
      /* ignore */
    }
  };

  const onMapClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const anchor = { lng: event.lngLat.lng, lat: event.lngLat.lat };

    if (!feature) {
      closePopup();
      return;
    }

    if (feature.layer?.id?.startsWith("mouza-")) {
      const props = (feature.properties ?? {}) as Record<string, string | null>;
      setHighlightPlot(props.plotNo ?? null);

      const fallback: MouzaDetail = {
        mauza: props.mauza ?? "",
        mCode: props.mCode ?? null,
        jlNo: props.jlNo ?? "",
        plotNo: props.plotNo ?? null,
        sheetNo: props.sheetNo ?? null,
        revenueNo: props.revenueNo ?? null,
        project: props.project ?? null,
        mDistrict: props.mDistrict ?? null,
        mUpazila: props.mUpazila ?? null,
        landType: props.landType ?? null,
        landClass: props.landClass ?? null,
        mAcres: props.mAcres ?? null,
        syncStatus: props.syncStatus ?? null,
        featureId: props.recordId ?? null,
      };

      const mouzaId = props.mouzaId as string | undefined;
      if (mouzaId) {
        void loadMouzaDetail(mouzaId, props.plotNo ?? null, anchor, fallback);
      } else {
        setPopup({
          kind: "mouza",
          detail: {
            ...fallback,
            coordinates: formatCoordinates(anchor.lat, anchor.lng),
          },
          anchor,
        });
      }
      return;
    }

    const sourceId = feature.layer?.source ?? "";
    const layerMeta = layers.find((l) => l.id === sourceId);
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const featureId =
      (properties.id as string | undefined) ??
      (feature.id as string | number | undefined)?.toString() ??
      null;
    const coordinates = formatCoordinates(anchor.lat, anchor.lng);

    setHighlightPlot(null);
    setPdfViewer(null);
    setPopupLoading(true);
    setPopup({
      kind: "gis",
      layerName: layerMeta?.layerName ?? String(feature.layer?.id ?? "Feature"),
      geometryType: feature.geometry.type,
      properties,
      featureId,
      anchor,
    });

    void fetch("/api/maps/resolve-property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties,
        featureId,
        coordinates,
        layerName: layerMeta?.layerName ?? null,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!data.detail?.propertyId && !data.detail?.plotNo) return;
        setPopup({
          kind: "mouza",
          detail: {
            ...(data.detail as MouzaDetail),
            coordinates:
              (data.detail as MouzaDetail).coordinates ?? coordinates,
            featureId:
              (data.detail as MouzaDetail).featureId ?? featureId,
          },
          anchor,
        });
      })
      .catch(() => undefined)
      .finally(() => setPopupLoading(false));
  };

  const openDocument = useCallback(async (action: PropertyDocumentAction) => {
    if (!action.available || !action.propertyId || !action.documentId) return;

    setPdfViewer({
      title: action.label,
      fileName: action.fileName ?? "document.pdf",
      url: null,
      loading: true,
      error: null,
    });

    try {
      const res = await fetch(
        `/api/properties/${action.propertyId}/documents?preview=${action.documentId}`,
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Unable to open document");
      }
      setPdfViewer({
        title: action.label,
        fileName: data.fileName ?? action.fileName ?? "document.pdf",
        url: data.url,
        loading: false,
        error: null,
      });
    } catch (error) {
      setPdfViewer({
        title: action.label,
        fileName: action.fileName ?? "document.pdf",
        url: null,
        loading: false,
        error:
          error instanceof Error ? error.message : "Unable to open document",
      });
    }
  }, []);

  const popupSections = useMemo(() => {
    if (!popup) return [];
    if (popup.kind === "mouza") {
      return buildMouzaPopupSections(popup.detail);
    }
    return buildGisLayerPopupSections({
      layerName: popup.layerName,
      geometryType: popup.geometryType,
      properties: popup.properties,
      featureId: popup.featureId,
      coordinates: formatCoordinates(popup.anchor.lat, popup.anchor.lng),
    });
  }, [popup]);

  const documentActions = useMemo(() => {
    if (!popup || popup.kind !== "mouza") return [];
    return buildPropertyDocumentActions(popup.detail);
  }, [popup]);

  const propertyLinks = useMemo(() => {
    if (!popup) return [];
    if (popup.kind === "mouza") {
      return buildPropertyPopupLinks(popup.detail, {
        mapId: selectedMapId || null,
      });
    }
    return buildPropertyPopupLinks(null, {
      mapId: selectedMapId || null,
      gisProperties: popup.properties,
      featureId: popup.featureId,
    });
  }, [popup, selectedMapId]);

  const popupTitle = useMemo(() => {
    if (!popup) return "Feature Details";
    if (popup.kind === "mouza") {
      if (popup.detail.plotNo) return `Plot ${popup.detail.plotNo}`;
      return popup.detail.mauza ?? "Mouza Details";
    }
    return popup.layerName;
  }, [popup]);

  const interactiveLayerIds = useMemo(() => {
    const ids = getInteractiveLayerIds(layers);
    if (showMouzaLayer && mouzaGeojson?.features?.length) {
      ids.push("mouza-sync-fill", "mouza-sync-outline");
    }
    return ids;
  }, [layers, showMouzaLayer, mouzaGeojson]);

  const loadingCount = Object.values(layerStatus).filter(
    (s) => s === "loading",
  ).length;
  const errorCount =
    Object.values(layerStatus).filter((s) => s === "error").length +
    (mouzaStatus === "error" ? 1 : 0);

  const pdfPreferredLeft =
    popupPosition != null ? popupPosition.popup.x + 320 + 16 : undefined;
  const pdfPreferredTop = popupPosition?.popup.y;

  return (
    <div className={className ?? "grid gap-4 lg:grid-cols-3"}>
      <aside className="space-y-4 rounded-lg border border-sky-200 bg-white p-4 lg:col-span-1">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            Uploaded Map
          </label>
          <select
            value={selectedMapId}
            onChange={(e) => setSelectedMapId(e.target.value)}
            className="w-full rounded-md border border-sky-200 px-2 py-1.5 text-sm"
          >
            <option value="">Select map</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Basemap
          </p>
          {maptilerOk ? (
            <p className="mb-2 text-[10px] text-emerald-700">
              Powered by MapTiler
            </p>
          ) : maptilerOk === false && hasMaptilerKey() ? (
            <p className="mb-2 text-[10px] text-amber-700">
              MapTiler unavailable — using free basemap
            </p>
          ) : hasMaptilerKey() ? (
            <p className="mb-2 text-[10px] text-slate-500">
              Checking MapTiler key...
            </p>
          ) : (
            <p className="mb-2 text-[10px] text-amber-700">
              Add NEXT_PUBLIC_MAPTILER_KEY in .env.local for HD maps
            </p>
          )}
          {basemapWarning ? (
            <p className="mb-2 rounded bg-amber-50 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800">
              {basemapWarning}
            </p>
          ) : null}
          <div className="flex rounded-lg border border-sky-200 p-0.5">
            {BASEMAP_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBasemap(opt.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  basemap === opt.id
                    ? "bg-cyan-900 text-white"
                    : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Layers
            </p>
            <button
              type="button"
              onClick={() => void showPolygonLayers()}
              className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-cyan-900 hover:bg-sky-200"
            >
              Show polygons
            </button>
          </div>
          {layersMetaLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-6 animate-pulse rounded bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {layers.map((layer, index) => {
                const style = buildLayerStyle(
                  layer.geometryType,
                  index,
                  layer.styleJson,
                );
                const paint = (style.paint ?? {}) as Record<string, string>;
                const swatch =
                  paint["fill-color"] ?? paint["line-color"] ?? "#2563eb";
                const loadedCount = layerData[layer.id]?.features?.length ?? 0;
                const status = layerStatus[layer.id] ?? "idle";

                return (
                  <li key={layer.id} className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() => void toggleLayer(layer)}
                      />
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: swatch }}
                      />
                      <span className="truncate" title={layer.layerName}>
                        {layer.layerName}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                        {status === "loading"
                          ? "…"
                          : status === "error"
                            ? "!"
                            : loadedCount}
                      </span>
                    </div>
                    {status === "error" ? (
                      <div className="ml-6 flex items-center gap-2 text-[10px] text-red-600">
                        <span className="truncate">
                          {layerErrors[layer.id] ?? "Failed"}
                        </span>
                        <button
                          type="button"
                          onClick={() => void retryLayer(layer)}
                          className="shrink-0 font-medium underline"
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Mouza Layer (Synchronized)
          </p>
          <select
            value={mouzaDatasetId}
            onChange={(e) => setMouzaDatasetId(e.target.value)}
            className="mb-2 w-full rounded-md border border-sky-200 px-2 py-1.5 text-sm"
          >
            <option value="">No mouza dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showMouzaLayer}
              onChange={(e) => setShowMouzaLayer(e.target.checked)}
            />
            Show synchronized mouzas
            {mouzaGeojson?.features?.length ? (
              <span className="text-[10px] text-slate-400">
                ({mouzaGeojson.features.length} in view)
              </span>
            ) : null}
          </label>
          {mouzaStatus === "loading" ? (
            <p className="mt-1 text-[10px] text-slate-500">
              Loading mouza plots for viewport…
            </p>
          ) : null}
          {mouzaStatus === "error" ? (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-red-600">
              <span>{mouzaError ?? "Failed"}</span>
              <button
                type="button"
                onClick={() => refreshViewport()}
                className="font-medium underline"
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Search
          </p>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="flex-1 rounded-md border border-sky-200 px-2 py-1.5 text-sm"
              placeholder="District, upazila, mouza, JL, code, plot..."
            />
            <button
              type="button"
              onClick={runSearch}
              className="rounded-md bg-cyan-900 px-3 py-1.5 text-xs text-white"
            >
              Go
            </button>
          </div>
          {(searchResults.length > 0 || mouzaSearchResults.length > 0) && (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
              {mouzaSearchResults.map((r) => (
                <li key={r.recordId}>
                  <button
                    type="button"
                    className="w-full rounded bg-teal-50 px-2 py-1 text-left hover:bg-teal-100"
                    onClick={() => void zoomToMouzaResult(r)}
                  >
                    <span className="font-medium">{r.mauza}</span>
                    {r.plotNo ? ` · Plot ${r.plotNo}` : ""}
                    {r.syncStatus === "geometry_missing"
                      ? " (no geometry)"
                      : ""}
                  </button>
                </li>
              ))}
              {searchResults.map((r) => (
                <li key={r.featureId}>
                  <button
                    type="button"
                    className="w-full rounded bg-sky-50 px-2 py-1 text-left hover:bg-sky-100"
                    onClick={() => zoomToResult(r.centroid)}
                  >
                    {r.layerName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-sky-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Legend
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
            {layers
              .filter((l) => l.visible)
              .map((l, index) => {
                const style = buildLayerStyle(
                  l.geometryType,
                  index,
                  l.styleJson,
                );
                const paint = (style.paint ?? {}) as Record<string, string>;
                const color =
                  paint["fill-color"] ?? paint["line-color"] ?? "#2563eb";

                return (
                  <li key={l.id} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{l.layerName}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      </aside>

      <div className="relative overflow-hidden rounded-lg border border-sky-200 lg:col-span-2">
        <MapGL
          ref={mapRef}
          initialViewState={DEFAULT_VIEW}
          style={{ width: "100%", height: "min(70vh, 680px)" }}
          mapStyle={mapStyle}
          interactiveLayerIds={interactiveLayerIds}
          onClick={onMapClick}
          onLoad={() => {
            setMapReady(true);
            refreshViewport();
          }}
          onMouseMove={(e) => {
            setCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          }}
          onMove={(e) => setZoom(e.viewState.zoom)}
          onMoveEnd={() => scheduleViewportRefresh()}
          onError={() => {
            if (maptilerOk !== false) {
              setMaptilerOk(false);
              setBasemapWarning(
                "MapTiler basemap failed to load. Using free fallback — please verify your API key.",
              );
            }
          }}
          reuseMaps
        >
          <NavigationControl position="top-right" showCompass showZoom />
          <FullscreenControl position="top-right" />
          <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />

          {layers
            .filter((l) => l.visible && layerData[l.id]?.features?.length)
            .map((layer) => {
              const layerIndex = layers.findIndex((l) => l.id === layer.id);
              const style = buildLayerStyle(
                layer.geometryType,
                layerIndex,
                layer.styleJson,
              );
              const kind = getLayerRenderKind(layer.geometryType, style);
              const paint = getDefaultPaint(kind, style);

              return (
                <Source
                  key={layer.id}
                  id={layer.id}
                  type="geojson"
                  data={layerData[layer.id]}
                  generateId
                >
                  {kind === "line" ? (
                    <Layer
                      id={`${layer.id}-line`}
                      type="line"
                      paint={paint}
                      layout={{
                        "line-cap": "round",
                        "line-join": "round",
                      }}
                    />
                  ) : null}
                  {kind === "circle" ? (
                    <Layer
                      id={`${layer.id}-circle`}
                      type="circle"
                      paint={paint}
                    />
                  ) : null}
                  {kind === "fill" ? (
                    <Layer
                      id={`${layer.id}-fill`}
                      type="fill"
                      filter={POLYGON_GEOMETRY_FILTER}
                      paint={paint}
                    />
                  ) : null}
                  {kind === "fill" ? (
                    <Layer
                      id={`${layer.id}-outline`}
                      type="line"
                      filter={POLYGON_GEOMETRY_FILTER}
                      paint={{
                        "line-color":
                          (paint["fill-outline-color"] as string) ??
                          (paint["fill-color"] as string) ??
                          "#b91c1c",
                        "line-width": 2,
                        "line-opacity": 0.95,
                      }}
                    />
                  ) : null}
                </Source>
              );
            })}
          {showMouzaLayer && mouzaGeojson?.features?.length ? (
            <Source id="mouza-sync" type="geojson" data={mouzaGeojson}>
              <Layer
                id="mouza-sync-fill"
                type="fill"
                paint={{
                  "fill-color": [
                    "case",
                    ["==", ["get", "plotNo"], highlightPlot ?? ""],
                    "#f59e0b",
                    "#0d9488",
                  ],
                  "fill-opacity": 0.4,
                }}
              />
              <Layer
                id="mouza-sync-outline"
                type="line"
                paint={{
                  "line-color": [
                    "case",
                    ["==", ["get", "plotNo"], highlightPlot ?? ""],
                    "#d97706",
                    "#0f766e",
                  ],
                  "line-width": 2,
                }}
              />
            </Source>
          ) : null}
        </MapGL>

        {(loadingCount > 0 || mouzaStatus === "loading") && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-sky-200 bg-white/95 px-3 py-1.5 text-[11px] text-slate-600 shadow">
            Loading viewport layers…
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-1 text-[10px] text-slate-600 shadow">
          {coords
            ? `${coords.lat.toFixed(5)}°, ${coords.lng.toFixed(5)}° · Zoom ${zoom.toFixed(1)}`
            : `Zoom ${zoom.toFixed(1)}`}
          {errorCount > 0 ? ` · ${errorCount} layer error(s)` : ""}
        </div>

        <button
          type="button"
          onClick={() => fitToData(layerData, true)}
          className="absolute left-2 top-2 z-10 rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow hover:bg-white"
        >
          Fit to layers
        </button>

        <MapFeaturePopup
          open={popup != null}
          anchor={popup?.anchor ?? null}
          title={popupTitle}
          sections={popupSections}
          documents={documentActions}
          propertyLinks={propertyLinks}
          loading={popupLoading}
          suppressEscape={pdfViewer != null}
          onClose={closePopup}
          onOpenDocument={(action) => void openDocument(action)}
          onPositionChange={setPopupPosition}
          mapRef={mapRef}
        />

        <MapPdfViewer
          open={pdfViewer != null}
          title={pdfViewer?.title ?? "Document"}
          url={pdfViewer?.url ?? null}
          fileName={pdfViewer?.fileName}
          loading={pdfViewer?.loading}
          error={pdfViewer?.error}
          onClose={closePdfViewer}
          preferredLeft={pdfPreferredLeft}
          preferredTop={pdfPreferredTop}
        />
      </div>
      {popup == null && (
        <p className="text-xs text-slate-500 lg:col-span-3">
          Basemap loads first; plot layers stream in for the visible viewport as
          you pan and zoom. Click a plot to view documents.
        </p>
      )}
    </div>
  );
}
