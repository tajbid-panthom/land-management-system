"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Layer, Source, type MapRef } from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

type MouzaDetail = {
  plotNo: string | null;
  mauza: string;
  jlNo: string;
  sheetNo: string | null;
  revenueNo: string | null;
  project: string | null;
  mDistrict: string | null;
  mUpazila: string | null;
  landType: string | null;
  landClass: string | null;
  mAcres: string | null;
  khasArea: string | null;
  scale: string | null;
  prepDate: string | null;
};

type MouzaMapViewProps = {
  mouzaId: string;
  plotNo?: string;
  className?: string;
};

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-sky-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function MouzaMapView({ mouzaId, plotNo, className }: MouzaMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [detail, setDetail] = useState<MouzaDetail | null>(null);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        level: "detail",
        mouzaId,
      });
      if (plotNo) params.set("plotNo", plotNo);

      const geoParams = new URLSearchParams({
        level: "geojson",
        mouzaId,
      });
      if (plotNo) geoParams.set("plotNo", plotNo);

      const [detailRes, geoRes] = await Promise.all([
        fetch(`/api/mouza-gis/search?${params}`),
        fetch(`/api/mouza-gis/search?${geoParams}`),
      ]);

      if (detailRes.ok) {
        const data = await detailRes.json();
        setDetail(data.detail ?? null);
      }

      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo.features?.length > 0) {
          setGeojson(geo);
          const coords = geo.features[0].geometry.coordinates;
          if (coords && mapRef.current) {
            const flat = JSON.stringify(coords);
            const lngs = flat.match(/-?\d+\.\d+/g)?.map(Number) ?? [];
            if (lngs.length >= 2) {
              const lats = lngs.filter((_, i) => i % 2 === 1);
              const lngVals = lngs.filter((_, i) => i % 2 === 0);
              const centerLng = (Math.min(...lngVals) + Math.max(...lngVals)) / 2;
              const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
              mapRef.current.flyTo({ center: [centerLng, centerLat], zoom: 15 });
            }
          }
        } else {
          setGeojson(null);
        }
      }
    } catch {
      setError("Failed to load map data");
    } finally {
      setLoading(false);
    }
  }, [mouzaId, plotNo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className={className ?? "grid gap-4 lg:grid-cols-3"}>
      <div className="overflow-hidden rounded-lg border border-sky-200 lg:col-span-2">
        {loading ? (
          <div className="flex h-80 items-center justify-center bg-sky-50 text-sm text-slate-500">
            Loading map...
          </div>
        ) : error ? (
          <div className="flex h-80 items-center justify-center bg-red-50 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <Map
            ref={mapRef}
            initialViewState={{
              longitude: 90.4125,
              latitude: 23.8103,
              zoom: 11,
            }}
            style={{ width: "100%", height: 400 }}
            mapStyle="https://demotiles.maplibre.org/style.json"
          >
            {geojson && (
              <Source id="mouza-geo" type="geojson" data={geojson}>
                <Layer
                  id="mouza-fill"
                  type="fill"
                  paint={{
                    "fill-color": "#0d9488",
                    "fill-opacity": 0.35,
                  }}
                />
                <Layer
                  id="mouza-outline"
                  type="line"
                  paint={{
                    "line-color": "#0f766e",
                    "line-width": 2,
                  }}
                />
              </Source>
            )}
          </Map>
        )}
        {!loading && !geojson && (
          <p className="border-t border-sky-100 bg-sky-50 px-4 py-2 text-xs text-slate-500">
            No geometry available. Upload a shapefile (.shp + .dbf) to display boundaries.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-sky-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mouza Information
        </h3>
        {detail ? (
          <div>
            <DetailRow label="Mouza" value={detail.mauza} />
            <DetailRow label="Plot No" value={detail.plotNo} />
            <DetailRow label="JL No" value={detail.jlNo} />
            <DetailRow label="Sheet No" value={detail.sheetNo} />
            <DetailRow label="Revenue No" value={detail.revenueNo} />
            <DetailRow label="Project" value={detail.project} />
            <DetailRow label="District" value={detail.mDistrict} />
            <DetailRow label="Upazila / Thana" value={detail.mUpazila} />
            <DetailRow label="Land Type" value={detail.landType} />
            <DetailRow label="Land Class" value={detail.landClass} />
            <DetailRow label="Area (Acres)" value={detail.mAcres} />
            <DetailRow label="Khas Area" value={detail.khasArea} />
            <DetailRow label="Scale" value={detail.scale} />
            <DetailRow label="Preparation Date" value={detail.prepDate} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {loading ? "Loading..." : "No mapped data for this mouza."}
          </p>
        )}
      </div>
    </div>
  );
}
