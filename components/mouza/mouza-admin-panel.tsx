"use client";

import { useCallback, useEffect, useState } from "react";
import { MouzaCreateForm } from "./mouza-create-form";
import { MouzaMapView } from "./mouza-map-view";

type Dataset = {
  id: string;
  name: string;
  slug: string;
  districtName: string | null;
  recordCount: number;
  mappedCount: number;
  hasDbf: boolean;
};

type MouzaRow = {
  id: string;
  name: string;
  jlNumber: string;
  mCode: string | null;
  upazilaName: string | null;
  districtName: string | null;
  hasGis: boolean;
};

type ImportResult = {
  total: number;
  success: number;
  inserted: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
};

type MapResult = {
  matched: number;
  unmatchedRecords: number;
  unmatchedFeatures: number;
  duplicatesSkipped: number;
  errors: string[];
};

export function MouzaAdminPanel({
  initialMouzas,
}: {
  initialMouzas: MouzaRow[];
}) {
  const [mouzas, setMouzas] = useState(initialMouzas);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [activeTab, setActiveTab] = useState<"registry" | "import" | "create" | "map">("registry");
  const [selectedMouzaId, setSelectedMouzaId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [mapResult, setMapResult] = useState<MapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    const [mRes, dRes] = await Promise.all([
      fetch("/api/mouzas?limit=100"),
      fetch("/api/mouza-gis/datasets"),
    ]);
    const mData = await mRes.json();
    const dData = await dRes.json();
    setMouzas(mData.mouzas ?? []);
    setDatasets(dData.datasets ?? []);
    if (!selectedDataset && dData.datasets?.[0]) {
      setSelectedDataset(dData.datasets[0].id);
    }
  }, [selectedDataset]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  async function ensureDhakaNorthDataset() {
    const existing = datasets.find((d) => d.slug === "dhaka-north");
    if (existing) {
      setSelectedDataset(existing.id);
      return existing.id;
    }
    const res = await fetch("/api/mouza-gis/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dhaka North Mouza Data",
        slug: "dhaka-north",
        description: "Dhaka North City Corporation mouza GIS dataset",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create dataset");
    await refreshData();
    return data.dataset.id as string;
  }

  async function handleExcelImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setImportResult(null);

    try {
      let datasetId = selectedDataset;
      if (!datasetId) {
        datasetId = await ensureDhakaNorthDataset();
      }

      const form = e.currentTarget;
      const fileInput = form.elements.namedItem("excel") as HTMLInputElement;
      const file = fileInput.files?.[0];
      if (!file) throw new Error("Select an Excel file");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("datasetId", datasetId);

      const res = await fetch("/api/mouza-gis/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      setImportResult(data.result);
      setMessage(
        `Import complete: ${data.result.success} of ${data.result.total} rows (${data.result.inserted} new, ${data.result.updated} updated)`,
      );
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleShapefileUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      let datasetId = selectedDataset;
      if (!datasetId) {
        datasetId = await ensureDhakaNorthDataset();
      }

      const form = e.currentTarget;
      const fileInput = form.elements.namedItem("gisFile") as HTMLInputElement;
      const file = fileInput.files?.[0];
      if (!file) throw new Error("Select a .dbf or .zip file");

      const formData = new FormData();
      formData.append("datasetId", datasetId);
      formData.append("dbf", file);

      const res = await fetch("/api/mouza-gis/dbf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setMessage(
        data.message ??
          `Uploaded (v${data.file.version}): ${data.featureCount} records${data.hasGeometry ? " with geometry" : " (attributes only)"}`,
      );
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleMap() {
    setLoading(true);
    setError(null);
    setMapResult(null);

    try {
      if (!selectedDataset) throw new Error("Select a dataset first");

      const res = await fetch("/api/mouza-gis/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDataset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mapping failed");

      setMapResult(data.result);
      setMessage(`Mapping complete: ${data.result.matched} records matched`);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mapping failed");
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: "registry" as const, label: "Registry" },
    { id: "import" as const, label: "Import & Shapefile" },
    { id: "create" as const, label: "Create Mouza" },
    { id: "map" as const, label: "Map View" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-sky-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? "bg-teal-700 text-white"
                : "bg-sky-50 text-slate-700 hover:bg-sky-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === "registry" && (
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Mouza</th>
                <th className="px-4 py-3">JL</th>
                <th className="px-4 py-3">M Code</th>
                <th className="px-4 py-3">Upazila / Thana</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">GIS</th>
                <th className="px-4 py-3">Map</th>
              </tr>
            </thead>
            <tbody>
              {mouzas.map((m) => (
                <tr key={m.id} className="border-t border-sky-100">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">{m.jlNumber}</td>
                  <td className="px-4 py-3">{m.mCode ?? "—"}</td>
                  <td className="px-4 py-3">{m.upazilaName ?? "—"}</td>
                  <td className="px-4 py-3">{m.districtName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {m.hasGis ? (
                      <span className="text-teal-700">Mapped</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.hasGis && (
                      <button
                        type="button"
                        className="text-sm text-teal-700 hover:underline"
                        onClick={() => {
                          setSelectedMouzaId(m.id);
                          setActiveTab("map");
                        }}
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "import" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-sky-200 bg-white p-6">
            <h3 className="mb-4 font-semibold">Dhaka North Excel Import</h3>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Dataset</label>
              <select
                className="w-full rounded-md border border-sky-300 px-3 py-2 text-sm"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                <option value="">Dhaka North (auto-create)</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.recordCount} records, {d.mappedCount} mapped)
                  </option>
                ))}
              </select>
            </div>
            <form onSubmit={handleExcelImport} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Excel File</label>
                <input
                  name="excel"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="w-full text-sm"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Required columns: Plot_No, Mauza, Jl_No, M_Code, Mauza_JL_S
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? "Importing..." : "Import Excel"}
              </button>
            </form>
            {importResult && importResult.errors.length > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-3 text-xs">
                <p className="mb-2 font-medium text-amber-800">
                  {importResult.errors.length} row errors:
                </p>
                {importResult.errors.slice(0, 20).map((err) => (
                  <p key={`${err.row}-${err.message}`} className="text-amber-700">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-sky-200 bg-white p-6">
            <h3 className="mb-4 font-semibold">DBF / Shapefile Upload</h3>
            <p className="mb-4 text-xs text-slate-500">
              Upload a <strong>.dbf</strong> file for attribute mapping with Excel
              (via <strong>M_Code</strong> or <strong>Mauza_JL_S</strong>). For map
              boundaries, upload a <strong>.zip</strong> containing{" "}
              <strong>.shp</strong>, <strong>.shx</strong>, <strong>.dbf</strong>, and{" "}
              <strong>.prj</strong>.
            </p>
            <form onSubmit={handleShapefileUpload} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  DBF or Shapefile ZIP
                </label>
                <input
                  name="gisFile"
                  type="file"
                  accept=".dbf,.zip,application/zip,application/octet-stream"
                  className="w-full text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Upload DBF / Shapefile"}
              </button>
            </form>

            <div className="mt-6 border-t border-sky-100 pt-4">
              <h4 className="mb-2 text-sm font-semibold">Join Excel → Shapefile</h4>
              <p className="mb-3 text-xs text-slate-500">
                After both Excel and shapefile are uploaded, run mapping to join
                attributes (PostgreSQL) with geometry (PostGIS) using stable keys.
              </p>
              <button
                type="button"
                onClick={handleMap}
                disabled={loading || !selectedDataset}
                className="rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
              >
                {loading ? "Mapping..." : "Run Mapping"}
              </button>
              {mapResult && (
                <div className="mt-3 text-xs text-slate-600">
                  <p>Matched: {mapResult.matched}</p>
                  <p>Unmatched records: {mapResult.unmatchedRecords}</p>
                  <p>Unmatched features: {mapResult.unmatchedFeatures}</p>
                  <p>Duplicates skipped: {mapResult.duplicatesSkipped}</p>
                  {mapResult.errors.length > 0 && (
                    <p className="mt-1 text-red-600">
                      Errors: {mapResult.errors.join("; ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "create" && (
        <div className="rounded-lg border border-sky-200 bg-white p-6">
          <MouzaCreateForm onCreated={refreshData} />
        </div>
      )}

      {activeTab === "map" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Select Mouza</label>
            <select
              className="w-full max-w-md rounded-md border border-sky-300 px-3 py-2 text-sm"
              value={selectedMouzaId ?? ""}
              onChange={(e) => setSelectedMouzaId(e.target.value || null)}
            >
              <option value="">Choose a mouza with GIS data</option>
              {mouzas
                .filter((m) => m.hasGis)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (JL {m.jlNumber})
                  </option>
                ))}
            </select>
          </div>
          {selectedMouzaId && <MouzaMapView mouzaId={selectedMouzaId} />}
        </div>
      )}
    </div>
  );
}
