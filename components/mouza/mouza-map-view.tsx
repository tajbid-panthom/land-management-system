"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_VIEW, getBasemapStyle } from "@/lib/gis-maps/basemaps";
import { computeBounds } from "@/lib/gis-maps/layer-render";
import {
  buildMouzaPopupSections,
  formatCoordinates,
  type MouzaPopupDetail,
} from "@/lib/gis-maps/feature-popup";
import { MapFeaturePopup } from "@/components/gis-maps/map-feature-popup";

type MouzaMapViewProps = {
  mouzaId: string;
  plotNo?: string;
  className?: string;
};

export function MouzaMapView({ mouzaId, plotNo, className }: MouzaMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [detail, setDetail] = useState<MouzaPopupDetail | null>(null);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<{ lng: number; lat: number } | null>(
    null,
  );
  const [popupOpen, setPopupOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (targetPlotNo?: string | null, anchor?: { lng: number; lat: number }) => {
      const params = new URLSearchParams({ level: "detail", mouzaId });
      if (targetPlotNo) params.set("plotNo", targetPlotNo);
      const res = await fetch(`/api/mouza-gis/search?${params}`);
      if (!res.ok) return null;
      const data = await res.json();
      const nextDetail = (data.detail ?? null) as MouzaPopupDetail | null;
      if (nextDetail && anchor && !nextDetail.coordinates) {
        nextDetail.coordinates = formatCoordinates(anchor.lat, anchor.lng);
      }
      return nextDetail;
    },
    [mouzaId],
  );

  const closePopup = useCallback(() => {
    setPopupOpen(false);
    setPopupAnchor(null);
    setSelectedPlot(null);
    setDetail(null);
    setDetailLoading(false);
  }, []);

  const openFeaturePopup = useCallback(
    async (
      props: Record<string, string | null>,
      anchor: { lng: number; lat: number },
      clickedPlot: string | null,
    ) => {
      setPopupOpen(true);
      setPopupAnchor(anchor);
      setSelectedPlot(clickedPlot);
      setDetailLoading(true);
      setDetail({
        plotNo: clickedPlot,
        mauza: props.mauza ?? "",
        jlNo: props.jlNo ?? "",
        mCode: props.mCode ?? null,
        sheetNo: props.sheetNo ?? null,
        revenueNo: props.revenueNo ?? null,
        project: props.project ?? null,
        mDistrict: props.mDistrict ?? null,
        mUpazila: props.mUpazila ?? null,
        landType: props.landType ?? null,
        landClass: props.landClass ?? null,
        mAcres: props.mAcres ?? null,
        syncStatus: props.syncStatus ?? null,
        coordinates: formatCoordinates(anchor.lat, anchor.lng),
        featureId: props.recordId ?? null,
      });

      const fetched = clickedPlot ? await loadDetail(clickedPlot, anchor) : null;
      if (fetched) {
        setDetail(fetched);
      }
      setDetailLoading(false);
    },
    [loadDetail],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    closePopup();

    try {
      const geoParams = new URLSearchParams({ level: "geojson", mouzaId });
      if (plotNo) geoParams.set("plotNo", plotNo);

      const geoRes = await fetch(`/api/mouza-gis/search?${geoParams}`);

      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo.features?.length > 0) {
          setGeojson(geo);
          if (plotNo) {
            setSelectedPlot(plotNo);
          }
        } else {
          setGeojson(null);
        }
      } else {
        setGeojson(null);
      }
    } catch {
      setError("Failed to load map data");
    } finally {
      setLoading(false);
    }
  }, [closePopup, mouzaId, plotNo]);

  useEffect(() => {
    setMapReady(false);
    void loadData();
  }, [loadData]);

  const fitToGeojson = useCallback(() => {
    if (!geojson || !mapRef.current) return;
    const bounds = computeBounds([geojson]);
    if (bounds) {
      mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 800 });
    }
  }, [geojson]);

  useEffect(() => {
    if (!mapReady) return;
    fitToGeojson();
  }, [mapReady, fitToGeojson]);

  const onMapClick = async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature?.properties) {
      closePopup();
      return;
    }

    const props = feature.properties as Record<string, string | null>;
    const clickedPlot = props.plotNo ?? null;
    await openFeaturePopup(
      props,
      { lng: event.lngLat.lng, lat: event.lngLat.lat },
      clickedPlot,
    );
  };

  const popupSections = useMemo(
    () => (detail ? buildMouzaPopupSections(detail) : []),
    [detail],
  );

  const popupTitle = detail?.plotNo
    ? `Plot ${detail.plotNo}`
    : detail?.mauza
      ? detail.mauza
      : "Plot Details";

  return (
    <div className={className ?? "space-y-2"}>
      <div className="relative overflow-hidden rounded-lg border border-sky-200">
        {loading ? (
          <div className="flex h-[min(70vh,560px)] items-center justify-center bg-sky-50 text-sm text-slate-500">
            Loading map...
          </div>
        ) : error ? (
          <div className="flex h-[min(70vh,560px)] items-center justify-center bg-red-50 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <>
            <Map
              ref={mapRef}
              initialViewState={DEFAULT_VIEW}
              style={{ width: "100%", height: "min(70vh, 560px)" }}
              mapStyle={getBasemapStyle("street")}
              interactiveLayerIds={["mouza-fill", "mouza-outline"]}
              onLoad={() => {
                setMapReady(true);
                fitToGeojson();
              }}
              onClick={onMapClick}
            >
              {geojson && (
                <Source id="mouza-geo" type="geojson" data={geojson}>
                  <Layer
                    id="mouza-fill"
                    type="fill"
                    paint={{
                      "fill-color": [
                        "case",
                        ["==", ["get", "plotNo"], selectedPlot ?? ""],
                        "#f59e0b",
                        "#0d9488",
                      ],
                      "fill-opacity": 0.35,
                    }}
                  />
                  <Layer
                    id="mouza-outline"
                    type="line"
                    paint={{
                      "line-color": [
                        "case",
                        ["==", ["get", "plotNo"], selectedPlot ?? ""],
                        "#d97706",
                        "#0f766e",
                      ],
                      "line-width": 2,
                    }}
                  />
                </Source>
              )}
            </Map>

            <MapFeaturePopup
              open={popupOpen}
              anchor={popupAnchor}
              title={popupTitle}
              sections={popupSections}
              loading={detailLoading}
              onClose={closePopup}
              mapRef={mapRef}
            />
          </>
        )}
        {!loading && !geojson && (
          <p className="border-t border-sky-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            No geometry found — upload a shapefile with .shp geometry to display boundaries.
          </p>
        )}
      </div>
      {!loading && geojson && !popupOpen && (
        <p className="text-xs text-slate-500">
          Click a plot on the map to view details.
        </p>
      )}
    </div>
  );
}
