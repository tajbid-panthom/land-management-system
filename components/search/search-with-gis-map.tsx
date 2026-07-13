"use client";

import { useCallback, useState } from "react";
import type { Geometry } from "geojson";
import { ParcelSearchForm, type ParcelSearchResult } from "@/components/search/parcel-search-form";
import { GisMapViewer } from "@/components/gis-maps/gis-map-viewer";

type FocusPlot = {
  mouzaId?: string;
  plotNo?: string;
  featureId?: string;
  mauza?: string;
  geometry?: Geometry | null;
  layerId?: string;
};

export function SearchWithGisMap({
  isAuthenticated,
  canViewDocuments = false,
}: {
  isAuthenticated: boolean;
  /** Super admin / staff who may open deeds & mutation in the map modal. */
  canViewDocuments?: boolean;
}) {
  const [searchActive, setSearchActive] = useState(false);
  const [focusPlot, setFocusPlot] = useState<FocusPlot | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleResults = useCallback((results: ParcelSearchResult[]) => {
    setSearchActive(true);
    setFocusPlot(null);
    if (results.length === 0) {
      setStatus("No parcels matched. The map stays in browse mode.");
      return;
    }
    setStatus(
      `${results.length} parcel${results.length === 1 ? "" : "s"} found. Select a row to zoom the map${
        canViewDocuments
          ? " and open deed / mutation documents when available."
          : ". Sign in as an admin to view deeds and mutation certificates."
      }`,
    );
  }, [canViewDocuments]);

  const handleSelect = useCallback(
    async (parcel: ParcelSearchResult) => {
      setSearchActive(true);
      setStatus(`Locating plot ${parcel.plotNumber} on the GIS map…`);

      const params = new URLSearchParams({
        plotNo: parcel.plotNumber,
      });
      if (parcel.mouzaName) params.set("mauza", parcel.mouzaName);
      if (parcel.districtName) params.set("district", parcel.districtName);
      if (parcel.upazilaName) params.set("upazila", parcel.upazilaName);

      try {
        const res = await fetch(`/api/maps/locate-plot?${params}`);
        const data = await res.json();
        if (data.match?.featureId) {
          setFocusPlot({
            featureId: data.match.featureId,
            plotNo: parcel.plotNumber,
            mauza: parcel.mouzaName,
            mouzaId: parcel.mouzaId ?? undefined,
            geometry: (data.match.geometry as Geometry | null) ?? null,
            layerId: data.match.layerId ?? undefined,
          });
          setStatus(
            canViewDocuments
              ? `Showing plot ${parcel.plotNumber} on the map.`
              : `Showing plot ${parcel.plotNumber}. Sign in as an admin to view deeds and mutation certificates.`,
          );
          return;
        }
      } catch {
        /* fall through */
      }

      if (parcel.mouzaId && parcel.plotNumber) {
        setFocusPlot({
          mouzaId: parcel.mouzaId,
          plotNo: parcel.plotNumber,
          mauza: parcel.mouzaName,
        });
        setStatus(
          canViewDocuments
            ? `Showing plot ${parcel.plotNumber}. Deed and mutation open from the map popup when uploaded.`
            : `Showing plot ${parcel.plotNumber}. Sign in as an admin to view deeds and mutation certificates.`,
        );
        return;
      }

      setStatus(
        `Plot ${parcel.plotNumber} was found in search, but no GIS geometry match was located. Pan the map or refine the search.`,
      );
    },
    [canViewDocuments],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
      <div className="flex flex-col gap-4 lg:col-span-5">
        <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Search parcels
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Search first to focus plots on the map. Without a search, the map is
            browse-only (no property documents).
          </p>
          <div className="mt-4">
            <ParcelSearchForm
              onResults={handleResults}
              onSelectResult={handleSelect}
              stayOnPage
            />
          </div>
        </div>
        {status ? (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            {status}
          </p>
        ) : null}
        {!canViewDocuments ? (
          <p className="text-xs text-slate-500">
            {isAuthenticated
              ? "Your account can browse plots on the map. Super admin / land / legal officers can open registration deeds and mutation certificates from the floating modal."
              : (
                <>
                  You are browsing as a guest.{" "}
                  <a
                    href="/login"
                    className="font-medium text-teal-700 hover:underline"
                  >
                    Log in
                  </a>{" "}
                  as an admin to open registration deeds and mutation
                  certificates for matched properties.
                </>
              )}
          </p>
        ) : null}
      </div>

      <div className="min-h-[560px] lg:col-span-7">
        <GisMapViewer
          embedded
          isAuthenticated={canViewDocuments}
          requireSearchForDetails
          searchActive={searchActive}
          focusPlot={focusPlot ?? undefined}
          className="h-full min-h-[560px]"
        />
      </div>
    </div>
  );
}
