"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPORTED_GIS_FORMATS, statusLabel } from "@/lib/gis-maps/constants";

type DetectedLayer = {
  name: string;
  geometry: string;
  features: number;
};

type LayerProgress = {
  name: string;
  tableName: string;
  geometry: string;
  features: number;
  imported: number;
  status: "pending" | "processing" | "imported" | "failed";
  error?: string;
};

type JobStatus = {
  status: string;
  progress: number;
  message: string | null;
  errorMessage?: string | null;
};

function formatLogLine(line: string): string {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/);
  if (!match) return line;
  const time = new Date(match[1]).toLocaleTimeString();
  return `${time} — ${match[2]}`;
}

function layerStatusLabel(status: LayerProgress["status"]): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "processing":
      return "Importing…";
    case "imported":
      return "Done";
    case "failed":
      return "Failed";
  }
}

function parseLayersFromLogs(logs: string[]): LayerProgress[] {
  const layers: LayerProgress[] = [];
  const seen = new Set<string>();

  for (const raw of logs) {
    const line = raw.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+/, "");

    const processing = line.match(
      /\[(\d+)\/(\d+)\] Processing layer: (.+?)\.\.\./,
    );
    if (processing) {
      const name = processing[3].trim();
      if (!seen.has(name)) {
        seen.add(name);
        layers.push({
          name,
          tableName: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          geometry: "—",
          features: 0,
          imported: 0,
          status: "processing",
        });
      }
      continue;
    }

    const done = line.match(/✓ (.+?): (\w+), (\d+) features/);
    if (done) {
      const name = done[1].trim();
      const existing = layers.find((l) => l.name === name);
      if (existing) {
        existing.geometry = done[2];
        existing.features = Number(done[3]);
        existing.status = "pending";
      } else if (!seen.has(name)) {
        seen.add(name);
        layers.push({
          name,
          tableName: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          geometry: done[2],
          features: Number(done[3]),
          imported: 0,
          status: "pending",
        });
      }
    }
  }

  return layers;
}

function layerStatusColor(status: LayerProgress["status"]): string {
  switch (status) {
    case "pending":
      return "bg-slate-100 text-slate-600";
    case "processing":
      return "bg-amber-100 text-amber-800";
    case "imported":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
  }
}

export function GisUploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [detectedLayers, setDetectedLayers] = useState<DetectedLayer[]>([]);
  const [layersProgress, setLayersProgress] = useState<LayerProgress[]>([]);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [processingLogs]);

  const pollJob = useCallback(async (jobId: string) => {
    setPolling(true);

    const poll = async () => {
      try {
        const res = await fetch(`/api/maps/status/${jobId}`);
        if (!res.ok) return false;
        const data = (await res.json()) as JobStatus & {
          mapId?: string;
          logs?: string[];
          layersProgress?: LayerProgress[];
        };

        setJobStatus({
          status: data.status,
          progress: data.progress,
          message: data.message,
          errorMessage: data.errorMessage,
        });
        setProcessingLogs(data.logs ?? []);
        if (data.layersProgress && data.layersProgress.length > 0) {
          setLayersProgress(data.layersProgress);
        } else if (data.logs && data.logs.length > 0) {
          const fromLogs = parseLayersFromLogs(data.logs);
          if (fromLogs.length > 0) setLayersProgress(fromLogs);
        }

        if (data.status.toLowerCase().includes("failed")) {
          setError(data.errorMessage ?? data.message ?? "Processing failed");
          if (data.mapId) {
            const mapRes = await fetch(`/api/maps/${data.mapId}`);
            if (mapRes.ok) {
              const mapData = await mapRes.json();
              setDetectedLayers(
                (mapData.layers ?? []).map(
                  (l: {
                    layerName: string;
                    geometryType: string;
                    featureCount: number;
                  }) => ({
                    name: l.layerName,
                    geometry: l.geometryType ?? "Unknown",
                    features: l.featureCount ?? 0,
                  }),
                ),
              );
            }
          }
          return true;
        }

        if (
          data.progress >= 100 ||
          data.status.toLowerCase().includes("completed")
        ) {
          if (data.mapId) {
            const mapRes = await fetch(`/api/maps/${data.mapId}`);
            if (mapRes.ok) {
              const mapData = await mapRes.json();
              setDetectedLayers(
                (mapData.layers ?? []).map(
                  (l: {
                    layerName: string;
                    geometryType: string;
                    featureCount: number;
                  }) => ({
                    name: l.layerName,
                    geometry: l.geometryType ?? "Unknown",
                    features: l.featureCount ?? 0,
                  }),
                ),
              );
            }
          }
          return true;
        }

        return false;
      } catch {
        return true;
      }
    };

    const interval = setInterval(async () => {
      const done = await poll();
      if (done) {
        clearInterval(interval);
        setPolling(false);
      }
    }, 1000);

    void poll();

    return () => clearInterval(interval);
  }, []);

  const uploadFile = async () => {
    if (!file) return;
    setError(null);
    setUploadProgress(0);
    setJobStatus(null);
    setDetectedLayers([]);
    setLayersProgress([]);
    setProcessingLogs([]);

    const formData = new FormData();
    formData.append("file", file);
    if (name.trim()) formData.append("name", name.trim());

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      const result = await new Promise<{ jobId: string; mapId: string }>(
        (resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              try {
                const body = JSON.parse(xhr.responseText);
                reject(new Error(body.error ?? "Upload failed"));
              } catch {
                reject(new Error("Upload failed"));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("POST", "/api/maps/upload");
          xhr.send(formData);
        },
      );

      setJobStatus({
        status: "Queued",
        progress: 0,
        message: "Processing started",
      });
      setProcessingLogs(["Upload received — processing started"]);
      void pollJob(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${
              dragging
                ? "border-cyan-600 bg-cyan-50"
                : "border-sky-300 bg-white hover:border-cyan-500"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={SUPPORTED_GIS_FORMATS.map((f) => `.${f}`).join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-lg font-medium text-slate-800">Drag &amp; Drop MPK</p>
            <p className="mt-3">
              <span className="inline-flex items-center justify-center rounded-md border border-teal-800 bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                Choose File
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-500">
              or drop a supported GIS file here
            </p>
            {file && (
              <p className="mt-4 text-sm font-medium text-cyan-900">{file.name}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Map name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2 text-sm"
              placeholder="District boundary map"
            />
          </div>

          <button
            type="button"
            disabled={!file || polling}
            onClick={uploadFile}
            className="rounded-md bg-cyan-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {polling ? "Processing..." : "Upload & Process"}
          </button>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Supported Files</p>
            <ul className="grid grid-cols-2 gap-1 text-sm text-slate-600">
              {SUPPORTED_GIS_FORMATS.map((fmt) => (
                <li key={fmt}>✔ {fmt.toUpperCase()}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-sky-200 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Upload Progress</p>
            <div className="h-3 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full bg-cyan-700 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-500">{uploadProgress}%</p>
          </div>

          <div className="rounded-lg border border-sky-200 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Processing Status</p>
            {jobStatus ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-cyan-900">
                  {statusLabel(jobStatus.status.toLowerCase().replace(/\s+/g, "_"))}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-sky-100">
                  <div
                    className="h-full bg-teal-600 transition-all"
                    style={{ width: `${jobStatus.progress}%` }}
                  />
                </div>
                <p className="text-slate-600">{jobStatus.message}</p>
                {jobStatus.errorMessage && (
                  <p className="text-red-600">{jobStatus.errorMessage}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Waiting for upload...</p>
            )}
          </div>

          <div className="rounded-lg border border-sky-200 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Processing Layers
              {layersProgress.length > 0 && (
                <span className="ml-2 font-normal text-slate-500">
                  ({layersProgress.filter((l) => l.status === "imported").length}/
                  {layersProgress.length} imported
                  {layersProgress.some((l) => l.status === "failed") && (
                    <span className="text-red-600">
                      {" "}
                      · {layersProgress.filter((l) => l.status === "failed").length}{" "}
                      failed
                    </span>
                  )}
                  )
                </span>
              )}
            </p>
            {layersProgress.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-md border border-sky-100">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-sky-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Layer</th>
                      <th className="px-2 py-1.5">Type</th>
                      <th className="px-2 py-1.5">Features</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layersProgress.map((layer) => (
                      <tr key={layer.name} className="border-t border-sky-50">
                        <td className="px-2 py-1.5 font-medium text-slate-800">
                          {layer.name}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">{layer.geometry}</td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {layer.status === "processing" && layer.imported > 0
                            ? `${layer.imported}/${layer.features}`
                            : layer.features}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${layerStatusColor(layer.status)}`}
                          >
                            {layerStatusLabel(layer.status)}
                          </span>
                        </td>
                        <td
                          className="max-w-[120px] truncate px-2 py-1.5 text-[10px] text-red-600"
                          title={layer.error}
                        >
                          {layer.error ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : detectedLayers.length > 0 ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                {detectedLayers.map((layer) => (
                  <li
                    key={layer.name}
                    className="flex justify-between rounded-md bg-sky-50 px-2 py-1.5"
                  >
                    <span className="font-medium">{layer.name}</span>
                    <span className="text-slate-500">
                      {layer.geometry} · {layer.features}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Layers appear here during Python processing and PostGIS import.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-sky-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            Processing Logs
            {processingLogs.length > 0 && (
              <span className="ml-2 font-normal text-slate-500">
                ({processingLogs.length} entries)
              </span>
            )}
          </p>
          {polling && (
            <span className="text-xs text-cyan-700">Live · updating every second</span>
          )}
        </div>
        {processingLogs.length > 0 ? (
          <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-md bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
            {processingLogs.map((line, i) => (
              <p
                key={`${line}-${i}`}
                className={`leading-relaxed ${
                  line.includes("✗") || line.includes("Failed")
                    ? "text-red-300"
                    : line.includes("✓")
                      ? "text-green-300"
                      : line.includes("PostGIS")
                        ? "text-cyan-200"
                        : ""
                }`}
              >
                {formatLogLine(line)}
              </p>
            ))}
            <div ref={logsEndRef} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Full processing log — extraction, layer discovery, GeoJSON export, and PostGIS
            import batches.
          </p>
        )}
      </div>

      {detectedLayers.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-2 text-sm font-semibold text-green-900">
            Imported to PostGIS ({detectedLayers.length} layers)
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {detectedLayers.map((layer) => (
              <li
                key={layer.name}
                className="rounded-md bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span className="font-medium text-slate-800">{layer.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {layer.geometry} · {layer.features.toLocaleString()} features
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
