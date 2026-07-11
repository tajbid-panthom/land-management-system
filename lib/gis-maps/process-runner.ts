import { spawn } from "child_process";
import { join } from "path";
import { db } from "@/lib/db";
import {
  gisMaps,
  gisLayers,
  gisProcessingJobs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUploadPaths } from "./storage";
import {
  canUseTypeScriptProcessor,
  processWithTypeScript,
} from "./ts-processor";
import {
  importLayersToPostgis,
  type LayerProgress,
} from "./postgis-importer";
import { resolveDefaultLayerVisibility } from "./layer-visibility";

type ProgressUpdate = {
  status: string;
  progress: number;
  message: string;
};

type PythonResult = {
  status: string;
  layers?: Array<{
    name: string;
    table_name: string;
    geometry: string;
    features: number;
    bbox?: [number, number, number, number];
    geojson_path?: string;
    style_json?: Record<string, unknown>;
    sort_order?: number;
  }>;
  bbox?: [number, number, number, number];
  manifest_path?: string;
  error?: string;
};

function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "_");
}

async function updateJob(
  jobId: string,
  mapId: string,
  update: Partial<{
    status: string;
    progress: number;
    message: string;
    errorMessage: string | null;
    result: Record<string, unknown> | null;
    completedAt: Date | null;
  }>,
) {
  const mapStatus = update.status ? normalizeStatus(update.status) : undefined;

  await db
    .update(gisProcessingJobs)
    .set({
      status: mapStatus,
      progress: update.progress,
      message: update.message,
      errorMessage: update.errorMessage ?? undefined,
      result: update.result ?? undefined,
      completedAt: update.completedAt ?? undefined,
    })
    .where(eq(gisProcessingJobs.id, jobId));

  if (mapStatus) {
    await db
      .update(gisMaps)
      .set({
        status: mapStatus,
        updatedAt: new Date(),
        errorMessage: update.errorMessage ?? undefined,
      })
      .where(eq(gisMaps.id, mapId));
  }
}

async function appendLog(mapId: string, line: string) {
  const [map] = await db
    .select({ log: gisMaps.processingLog })
    .from(gisMaps)
    .where(eq(gisMaps.id, mapId))
    .limit(1);

  const log = [...(map?.log ?? []), `${new Date().toISOString()} ${line}`].slice(
    -500,
  );

  await db
    .update(gisMaps)
    .set({ processingLog: log, updatedAt: new Date() })
    .where(eq(gisMaps.id, mapId));
}

function makeImportCallbacks(
  mapId: string,
  jobId: string,
): {
  onLog: (message: string) => Promise<void>;
  onProgress: (
    layers: LayerProgress[],
    jobProgress: number,
    message: string,
  ) => Promise<void>;
} {
  return {
    onLog: async (message) => appendLog(mapId, message),
    onProgress: async (layers, jobProgress, message) => {
      await updateJob(jobId, mapId, {
        status: "importing",
        progress: jobProgress,
        message,
        result: { layersProgress: layers },
      });
    },
  };
}

async function runTypeScriptFallback(
  mapId: string,
  jobId: string,
  inputPath: string,
  fileName: string,
) {
  await updateJob(jobId, mapId, {
    status: "extracting",
    progress: 15,
    message: "Processing with built-in parser...",
  });
  await appendLog(mapId, "Using TypeScript GIS parser");

  const tsLayers = await processWithTypeScript(inputPath, fileName);

  if (tsLayers.length === 0) {
    throw new Error("No layers found in uploaded file.");
  }

  await appendLog(
    mapId,
    `TypeScript parser found ${tsLayers.length} layer(s): ${tsLayers.map((l) => l.name).join(", ")}`,
  );

  const layerInputs = tsLayers.map((layer, idx) => ({
    meta: {
      name: layer.name,
      table_name: layer.tableName,
      geometry: layer.geometryType,
      features: layer.features.length,
      style_json: (() => {
        const geom = layer.geometryType.toLowerCase();
        const color = "#2563eb";
        if (geom.includes("line")) {
          return {
            type: "line",
            paint: { "line-color": color, "line-width": 2 },
          };
        }
        if (geom.includes("point")) {
          return {
            type: "circle",
            paint: { "circle-color": color, "circle-radius": 5 },
          };
        }
        return {
          type: "fill",
          paint: { "fill-color": color, "fill-opacity": 0.55 },
        };
      })(),
      sort_order: idx,
    },
    features: layer.features.map((f) => ({
      attributes: f.attributes as Record<string, unknown>,
      geometry: f.geometry,
    })),
  }));

  const progress = await importLayersToPostgis(
    mapId,
    layerInputs,
    makeImportCallbacks(mapId, jobId),
  );

  const imported = progress.filter((l) => l.status === "imported");
  const failed = progress.filter((l) => l.status === "failed");

  const finalStatus = failed.length > 0 ? "failed" : "completed";
  const finalMessage =
    failed.length > 0
      ? `Completed with errors: ${imported.length}/${tsLayers.length} layers imported`
      : "Import completed.";

  await updateJob(jobId, mapId, {
    status: finalStatus,
    progress: 100,
    message: finalMessage,
    errorMessage:
      failed.length > 0
        ? `${failed.length} layer(s) failed during PostGIS import`
        : undefined,
    result: { layers: imported, layersProgress: progress },
    completedAt: new Date(),
  });

  await db
    .update(gisMaps)
    .set({
      status: finalStatus,
      errorMessage:
        failed.length > 0
          ? `${failed.length} layer(s) failed during PostGIS import`
          : undefined,
      updatedAt: new Date(),
    })
    .where(eq(gisMaps.id, mapId));

  await appendLog(
    mapId,
    failed.length > 0
      ? `Finished with errors — ${imported.length} imported, ${failed.length} failed`
      : `Completed with ${imported.length} layer(s) in PostGIS`,
  );
}

export async function startMapProcessing(mapId: string, jobId: string) {
  const paths = getUploadPaths(mapId);

  const [map] = await db
    .select()
    .from(gisMaps)
    .where(eq(gisMaps.id, mapId))
    .limit(1);

  if (!map) throw new Error("Map not found");

  const inputPath = join(paths.original, map.originalFileName);

  await db
    .update(gisProcessingJobs)
    .set({ startedAt: new Date(), status: "extracting", progress: 5 })
    .where(eq(gisProcessingJobs.id, jobId));

  await appendLog(mapId, `Processing started — file: ${map.originalFileName}`);
  await appendLog(
    mapId,
    `File size: ${map.fileSizeBytes ? `${(map.fileSizeBytes / 1024 / 1024).toFixed(2)} MB` : "unknown"}`,
  );

  try {
    let result: PythonResult | null = null;

    try {
      const child = spawn("python3", ["--version"]);
      await new Promise<void>((resolve, reject) => {
        child.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error("python3 unavailable")),
        );
        child.on("error", reject);
      });

      await appendLog(mapId, "Python 3 available — starting GIS processor");

      const pythonChild = spawn(
        "python3",
        [
          join(process.cwd(), "python", "process_mpk.py"),
          "--input",
          inputPath,
          "--output",
          paths.root,
          "--job-id",
          jobId,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      pythonChild.stderr.on("data", async (chunk: Buffer) => {
        const lines = chunk.toString().trim().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const progress = JSON.parse(line) as ProgressUpdate;
            await updateJob(jobId, mapId, {
              status: normalizeStatus(progress.status),
              progress: progress.progress,
              message: progress.message,
            });
            await appendLog(mapId, progress.message);
          } catch {
            await appendLog(mapId, line);
          }
        }
      });

      result = await new Promise<PythonResult>((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        pythonChild.stdout.on("data", (c: Buffer) => {
          stdout += c.toString();
        });
        pythonChild.stderr.on("data", (c: Buffer) => {
          stderr += c.toString();
        });
        pythonChild.on("close", (code) => {
          try {
            const lines = stdout.trim().split("\n").filter(Boolean);
            const parsed = JSON.parse(
              lines[lines.length - 1] ?? "{}",
            ) as PythonResult;
            if (code !== 0 && parsed.status !== "Completed") {
              reject(
                new Error(
                  parsed.error ??
                    stderr.trim().split("\n").pop() ??
                    "Python processing failed",
                ),
              );
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(
              new Error(
                stderr.trim() || (e instanceof Error ? e.message : "Python failed"),
              ),
            );
          }
        });
        pythonChild.on("error", reject);
      });
    } catch (err) {
      const pythonError =
        err instanceof Error ? err.message : "Python processing failed";
      await appendLog(mapId, `Python error: ${pythonError}`);

      if (!canUseTypeScriptProcessor(map.originalFileName)) {
        throw new Error(
          `${pythonError}. Install Python GIS dependencies: pip install -r python/requirements.txt`,
        );
      }

      await appendLog(mapId, "Falling back to built-in TypeScript parser");
      await runTypeScriptFallback(
        mapId,
        jobId,
        inputPath,
        map.originalFileName,
      );
      return;
    }

    if (!result) {
      throw new Error("No processing result returned");
    }

    const layers = result.layers ?? [];
    await appendLog(
      mapId,
      `Python processing complete — ${layers.length} layer(s) ready for PostGIS`,
    );
    for (const layer of layers) {
      await appendLog(
        mapId,
        `  • ${layer.name} (${layer.geometry}, ${layer.features} features)`,
      );
    }

    const initialProgress: LayerProgress[] = layers.map((layer) => ({
      name: layer.name,
      tableName: layer.table_name,
      geometry: layer.geometry,
      features: layer.features,
      imported: 0,
      status: "pending",
    }));

    await updateJob(jobId, mapId, {
      status: "importing",
      progress: 78,
      message: `Ready to import ${layers.length} layer(s) into PostGIS`,
      result: { layersProgress: initialProgress },
    });

    const layerInputs = layers.map((layer) => ({
      meta: {
        name: layer.name,
        table_name: layer.table_name,
        geometry: layer.geometry,
        features: layer.features,
        bbox: layer.bbox,
        style_json: layer.style_json,
        sort_order: layer.sort_order,
        geojson_path: layer.geojson_path,
      },
      geojsonPath: layer.geojson_path,
    }));

    const progress = await importLayersToPostgis(
      mapId,
      layerInputs,
      makeImportCallbacks(mapId, jobId),
    );

    const imported = progress.filter((l) => l.status === "imported");
    const failed = progress.filter((l) => l.status === "failed");

    const finalStatus = failed.length > 0 ? "failed" : "completed";
    const finalMessage =
      failed.length > 0
        ? `Completed with errors: ${imported.length}/${layers.length} layers imported`
        : "Processing completed successfully.";

    await updateJob(jobId, mapId, {
      status: finalStatus,
      progress: 100,
      message: finalMessage,
      errorMessage:
        failed.length > 0
          ? `${failed.length} layer(s) failed during PostGIS import`
          : undefined,
      result: { layers, layersProgress: progress, bbox: result.bbox },
      completedAt: new Date(),
    });

    await db
      .update(gisMaps)
      .set({
        status: finalStatus,
        bbox: result.bbox,
        errorMessage:
          failed.length > 0
            ? `${failed.length} layer(s) failed during PostGIS import`
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(gisMaps.id, mapId));

    await appendLog(
      mapId,
      failed.length > 0
        ? `Finished with errors — ${imported.length} imported, ${failed.length} failed`
        : `All done — ${imported.length}/${layers.length} layer(s) in PostGIS`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await updateJob(jobId, mapId, {
      status: "failed",
      progress: 100,
      message,
      errorMessage: message,
      completedAt: new Date(),
    });
    await appendLog(mapId, `Failed: ${message}`);
  }
}

export async function reprocessMap(mapId: string, jobId: string) {
  await db.delete(gisLayers).where(eq(gisLayers.mapId, mapId));
  await appendLog(mapId, "Reprocess requested — cleared existing layers");
  await startMapProcessing(mapId, jobId);
}
