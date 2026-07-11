"use client";

import { useCallback, useEffect, useState } from "react";
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
  plotCount?: number;
  hasGis: boolean;
};

type SyncReport = {
  synced: number;
  updated: number;
  skipped: number;
  failed: number;
  geometryMissing: number;
  duplicateGeometries: number;
  unmatchedRecords: number;
};

type ActivityLog = {
  id: string;
  type: "import" | "shapefile";
  fileName: string;
  status: string;
  recordCount: number;
  successCount: number | null;
  errorCount: number | null;
  message: string | null;
  errors: Array<{ row?: number; message: string }> | null;
  version: number | null;
  isActive: boolean | null;
  storage: "cloudinary" | "local" | null;
  createdAt: string | null;
};

type UploadResult = {
  featureCount: number;
  recordCount?: number;
  hasGeometry: boolean;
  version: number;
  storage?: "cloudinary" | "local";
  sync?: SyncReport | null;
  message?: string;
  datasetName?: string;
};

export function MouzaAdminPanel() {
  const [mouzas, setMouzas] = useState<MouzaRow[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [newDatasetName, setNewDatasetName] = useState("");
  const [activeTab, setActiveTab] = useState<"registry" | "upload" | "map">("upload");
  const [selectedMouzaId, setSelectedMouzaId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchActivityLogs = useCallback(async (datasetId: string) => {
    if (!datasetId) {
      setActivityLogs([]);
      return;
    }
    const res = await fetch(`/api/mouza-gis/logs?datasetId=${datasetId}`);
    const data = await res.json();
    if (res.ok) {
      setActivityLogs(data.logs ?? []);
    }
  }, []);

  const fetchMouzas = useCallback(async (datasetId?: string) => {
    const params = new URLSearchParams({ limit: "500" });
    if (datasetId) params.set("datasetId", datasetId);
    const res = await fetch(`/api/mouzas?${params}`);
    const data = await res.json();
    if (res.ok) {
      setMouzas(data.mouzas ?? []);
    }
  }, []);

  const refreshData = useCallback(async () => {
    const dRes = await fetch("/api/mouza-gis/datasets");
    const dData = await dRes.json();
    const nextDatasets = dData.datasets ?? [];
    setDatasets(nextDatasets);
    setSelectedDataset((prev) => {
      const next = prev || nextDatasets[0]?.id || "";
      if (next) {
        void fetchActivityLogs(next);
        void fetchMouzas(next);
      } else {
        void fetchMouzas();
      }
      return next;
    });
  }, [fetchActivityLogs, fetchMouzas]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (selectedDataset) {
      void fetchActivityLogs(selectedDataset);
      void fetchMouzas(selectedDataset);
    } else {
      setActivityLogs([]);
      void fetchMouzas();
    }
  }, [selectedDataset, fetchActivityLogs, fetchMouzas]);

  async function createDataset() {
    if (!newDatasetName.trim()) {
      throw new Error("Enter a dataset name");
    }
    const slug = newDatasetName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const res = await fetch("/api/mouza-gis/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDatasetName.trim(),
        slug,
        description: "Mouza GIS dataset",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create dataset");
    setNewDatasetName("");
    setSelectedDataset(data.dataset.id);
    await refreshData();
    return data.dataset.id as string;
  }

  async function handleRepairCoordinates() {
    if (!selectedDataset) {
      setError("Select a dataset first");
      return;
    }
    setRepairing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/mouza-gis/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDataset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Repair failed");
      setMessage(
        `Map coordinates repaired and ${data.result?.synced ?? 0} plots re-synced.`,
      );
      setMapRefreshKey((k) => k + 1);
      await fetchMouzas(selectedDataset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setRepairing(false);
    }
  }

  async function handleShapefileUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setUploadResult(null);

    try {
      let datasetId = selectedDataset;
      if (!datasetId && newDatasetName.trim()) {
        datasetId = await createDataset();
      }

      const form = e.currentTarget;
      const fileInput = form.elements.namedItem("gisFile") as HTMLInputElement;
      const file = fileInput.files?.[0];
      if (!file) throw new Error("Select a shapefile ZIP");

      const formData = new FormData();
      if (datasetId) formData.append("datasetId", datasetId);
      formData.append("dbf", file);

      const res = await fetch("/api/mouza-gis/dbf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      if (data.dataset?.id) {
        setSelectedDataset(data.dataset.id);
      }

      setUploadResult({
        featureCount: data.featureCount,
        recordCount: data.recordCount,
        hasGeometry: data.hasGeometry,
        version: data.file.version,
        storage: data.storage,
        sync: data.sync,
        message: data.message,
        datasetName: data.dataset?.name,
      });
      setMessage(data.message ?? `Uploaded ${data.featureCount} plots`);
      await refreshData();
      if (data.dataset?.id) {
        await fetchActivityLogs(data.dataset.id);
        await fetchMouzas(data.dataset.id);
      }
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMouza(mouza: MouzaRow) {
    const confirmed = window.confirm(
      `Delete mouza "${mouza.name}" (JL ${mouza.jlNumber})? This removes linked parcels and GIS mappings.`,
    );
    if (!confirmed) return;

    setDeletingId(mouza.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/mouzas/${mouza.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");

      setMessage(`Deleted mouza "${mouza.name}"`);
      if (selectedMouzaId === mouza.id) {
        setSelectedMouzaId(null);
      }
      await fetchMouzas(selectedDataset || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const selectedDatasetInfo = datasets.find((d) => d.id === selectedDataset);
  const mappedMouzas = mouzas.filter((m) => m.hasGis);

  const tabs = [
    { id: "upload" as const, label: "Shapefile Upload" },
    { id: "registry" as const, label: "Registry" },
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

      {activeTab === "upload" && (
        <div className="grid gap-6">
          <div className="rounded-lg border border-sky-200 bg-white p-6">
            <h3 className="mb-2 font-semibold">Upload Shapefile</h3>
            <p className="mb-4 text-sm text-slate-600">
              Upload a <strong>.zip</strong> with shapefile components. The dataset is
              created automatically from the file (district name from shapefile attributes)
              or you can select/create one below. Registry and maps update immediately after sync.
            </p>

            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Dataset</label>
                <select
                  className="w-full rounded-md border border-sky-300 px-3 py-2 text-sm"
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                >
                  <option value="">Auto-detect from shapefile</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.mappedCount} mapped / {d.recordCount} records)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Or create new dataset</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDatasetName}
                    onChange={(e) => setNewDatasetName(e.target.value)}
                    placeholder="e.g. Dhaka North 2026"
                    className="w-full rounded-md border border-sky-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {selectedDatasetInfo && (
              <p className="mb-4 text-xs text-slate-500">
                Active dataset: <strong>{selectedDatasetInfo.name}</strong>
                {selectedDatasetInfo.districtName
                  ? ` · ${selectedDatasetInfo.districtName}`
                  : ""}
              </p>
            )}

            <form onSubmit={handleShapefileUpload} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Shapefile ZIP</label>
                <input
                  name="gisFile"
                  type="file"
                  accept=".zip,application/zip,application/octet-stream"
                  className="w-full max-w-md text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? "Uploading & mapping..." : "Upload & Sync"}
              </button>
            </form>

            {uploadResult && (
              <div className="mt-4 max-h-48 overflow-y-auto rounded border border-sky-200 bg-sky-50 p-3 text-xs">
                <p className="mb-2 font-medium text-slate-700">Sync Report</p>
                {uploadResult.datasetName && <p>Dataset: {uploadResult.datasetName}</p>}
                <p>Version: {uploadResult.version}</p>
                <p>Plots: {uploadResult.featureCount}</p>
                <p>Records: {uploadResult.recordCount ?? uploadResult.featureCount}</p>
                <p>Geometry: {uploadResult.hasGeometry ? "Yes" : "No"}</p>
                {uploadResult.storage && (
                  <p>Storage: {uploadResult.storage === "local" ? "Local disk" : "Cloudinary"}</p>
                )}
                {uploadResult.sync && (
                  <>
                    <p className="mt-2 font-medium text-teal-800">Registry Mapping</p>
                    <p>Synced: {uploadResult.sync.synced}</p>
                    <p>Updated: {uploadResult.sync.updated}</p>
                    <p>Skipped: {uploadResult.sync.skipped}</p>
                    <p>Failed: {uploadResult.sync.failed}</p>
                    <p>Geometry missing: {uploadResult.sync.geometryMissing}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-sky-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Upload Logs</h3>
              <button
                type="button"
                onClick={() => selectedDataset && fetchActivityLogs(selectedDataset)}
                disabled={!selectedDataset}
                className="text-xs text-teal-700 hover:underline disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
            {!selectedDataset ? (
              <p className="text-sm text-slate-500">
                Upload a shapefile to create a dataset and view logs here.
              </p>
            ) : activityLogs.length === 0 ? (
              <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-8 text-center text-sm text-slate-500">
                No shapefile uploads yet.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-sky-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Records</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs
                      .filter((log) => log.type === "shapefile")
                      .map((log) => (
                        <tr key={log.id} className="border-t border-sky-100 align-top">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                            {log.createdAt
                              ? new Date(log.createdAt).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2 max-w-48 truncate" title={log.fileName}>
                            {log.fileName}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                log.status === "active"
                                  ? "text-teal-700"
                                  : "text-slate-600"
                              }
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">{log.recordCount}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {log.message ?? "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "registry" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium">Filter by dataset</label>
            <select
              className="rounded-md border border-sky-300 px-3 py-2 text-sm"
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
            >
              <option value="">All datasets</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fetchMouzas(selectedDataset || undefined)}
              className="text-sm text-teal-700 hover:underline"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-sky-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mouza</th>
                  <th className="px-4 py-3">JL</th>
                  <th className="px-4 py-3">M Code</th>
                  <th className="px-4 py-3">Upazila / Thana</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Plots</th>
                  <th className="px-4 py-3">GIS</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mouzas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No mouzas yet. Upload a shapefile to populate the registry.
                    </td>
                  </tr>
                ) : (
                  mouzas.map((m) => (
                    <tr key={m.id} className="border-t border-sky-100">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3">{m.jlNumber}</td>
                      <td className="px-4 py-3">{m.mCode ?? "—"}</td>
                      <td className="px-4 py-3">{m.upazilaName ?? "—"}</td>
                      <td className="px-4 py-3">{m.districtName ?? "—"}</td>
                      <td className="px-4 py-3">{m.plotCount ?? "—"}</td>
                      <td className="px-4 py-3">
                        {m.hasGis ? (
                          <span className="text-teal-700">Mapped</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {m.hasGis && (
                            <button
                              type="button"
                              className="text-sm text-teal-700 hover:underline"
                              onClick={() => {
                                setSelectedMouzaId(m.id);
                                setActiveTab("map");
                              }}
                            >
                              View map
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-sm text-red-600 hover:underline disabled:opacity-50"
                            disabled={deletingId === m.id}
                            onClick={() => handleDeleteMouza(m)}
                          >
                            {deletingId === m.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "map" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label className="mb-1 block text-sm font-medium">Select Mouza</label>
              <select
                className="w-full max-w-md rounded-md border border-sky-300 px-3 py-2 text-sm"
                value={selectedMouzaId ?? ""}
                onChange={(e) => setSelectedMouzaId(e.target.value || null)}
              >
                <option value="">Choose a mouza with GIS data</option>
                {mappedMouzas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (JL {m.jlNumber})
                  </option>
                ))}
              </select>
            </div>
            {selectedDataset && (
              <button
                type="button"
                className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-sky-50 disabled:opacity-50"
                disabled={repairing}
                onClick={() => void handleRepairCoordinates()}
              >
                {repairing ? "Repairing..." : "Repair map coordinates"}
              </button>
            )}
          </div>
          {selectedMouzaId && (
            <MouzaMapView key={`${selectedMouzaId}-${mapRefreshKey}`} mouzaId={selectedMouzaId} />
          )}
        </div>
      )}
    </div>
  );
}
