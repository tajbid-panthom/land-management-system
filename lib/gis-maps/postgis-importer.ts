import { readFile } from "fs/promises";
import type { FeatureCollection } from "geojson";
import { pool } from "@/lib/db";
import { db } from "@/lib/db";
import { gisLayers, gisLayerFeatures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveDefaultLayerVisibility } from "./layer-visibility";

export type LayerProgress = {
  name: string;
  tableName: string;
  geometry: string;
  features: number;
  imported: number;
  status: "pending" | "processing" | "imported" | "failed";
  error?: string;
};

type LayerInput = {
  name: string;
  table_name: string;
  geometry: string;
  features: number;
  bbox?: [number, number, number, number];
  style_json?: Record<string, unknown>;
  sort_order?: number;
  geojson_path?: string;
};

type FeatureInput = {
  attributes: Record<string, unknown>;
  geometry: unknown;
};

type ImportCallbacks = {
  onLog: (message: string) => Promise<void>;
  onProgress: (
    layers: LayerProgress[],
    jobProgress: number,
    message: string,
  ) => Promise<void>;
};

const BATCH_SIZE = 50;

function truncateError(error: unknown, max = 180): string {
  const message = error instanceof Error ? error.message : String(error);
  const pgDetail = (error as { detail?: string })?.detail;
  const short = pgDetail ? `${message} — ${pgDetail}` : message;
  return short.length > max ? `${short.slice(0, max)}…` : short;
}

async function insertFeatureBatch(
  layerId: string,
  features: FeatureInput[],
): Promise<number> {
  if (features.length === 0) return 0;

  const geomJsons = features.map((f) => JSON.stringify(f.geometry));
  const propJsons = features.map((f) => JSON.stringify(f.attributes ?? {}));

  const result = await pool.query(
    `INSERT INTO gis_layer_features (layer_id, geom, properties)
     SELECT $1::uuid,
            ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(g), 4326))),
            p::jsonb
     FROM unnest($2::text[], $3::text[]) AS t(g, p)
     WHERE g IS NOT NULL AND g <> 'null'`,
    [layerId, geomJsons, propJsons],
  );

  return result.rowCount ?? features.length;
}

export async function importLayersToPostgis(
  mapId: string,
  layers: Array<{
    meta: LayerInput;
    features?: FeatureInput[];
    geojsonPath?: string;
  }>,
  callbacks: ImportCallbacks,
): Promise<LayerProgress[]> {
  const progress: LayerProgress[] = layers.map((layer) => ({
    name: layer.meta.name,
    tableName: layer.meta.table_name,
    geometry: layer.meta.geometry,
    features: layer.meta.features,
    imported: 0,
    status: "pending",
  }));

  const totalLayers = layers.length;

  await callbacks.onLog(
    `PostGIS import started — ${totalLayers} layer(s) queued`,
  );
  await callbacks.onProgress(progress, 80, "Importing layers into PostGIS...");

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const { meta, features: inlineFeatures, geojsonPath } = layers[layerIdx];
    progress[layerIdx].status = "processing";
    let insertedLayerId: string | null = null;

    const layerPct =
      80 + Math.floor((layerIdx / Math.max(totalLayers, 1)) * 15);
    await callbacks.onLog(
      `[${layerIdx + 1}/${totalLayers}] Processing layer: ${meta.name} (${meta.geometry}, ${meta.features} features)`,
    );
    await callbacks.onProgress(
      [...progress],
      layerPct,
      `Importing layer ${layerIdx + 1}/${totalLayers}: ${meta.name}...`,
    );

    try {
      let featureList: FeatureInput[] = inlineFeatures ?? [];

      if (geojsonPath ?? meta.geojson_path) {
        const path = geojsonPath ?? meta.geojson_path!;
        await callbacks.onLog(`  Reading GeoJSON: ${path}`);
        const raw = await readFile(path, "utf-8");
        const geojson = JSON.parse(raw) as FeatureCollection;
        featureList = (geojson.features ?? []).map((f) => ({
          attributes: (f.properties ?? {}) as Record<string, unknown>,
          geometry: f.geometry,
        }));
        await callbacks.onLog(
          `  Loaded ${featureList.length} feature(s) from GeoJSON`,
        );
      }

      await callbacks.onLog(`  Creating layer record: ${meta.table_name}`);
      const [insertedLayer] = await db
        .insert(gisLayers)
        .values({
          mapId,
          tableName: meta.table_name,
          layerName: meta.name,
          geometryType: meta.geometry,
          featureCount: meta.features,
          bbox: meta.bbox,
          styleJson: meta.style_json,
          sortOrder: meta.sort_order ?? layerIdx,
          visible: resolveDefaultLayerVisibility(meta.name, meta.geometry),
        })
        .returning();

      insertedLayerId = insertedLayer.id;

      const withGeometry = featureList.filter((f) => f.geometry);
      const totalFeatures = withGeometry.length;
      let importedCount = 0;
      let skippedCount = 0;

      if (totalFeatures === 0) {
        await callbacks.onLog(`  Warning: no geometries found for ${meta.name}`);
      } else {
        await callbacks.onLog(
          `  Inserting ${totalFeatures} feature(s) into PostGIS (2D, batched)...`,
        );

        for (let i = 0; i < totalFeatures; i += BATCH_SIZE) {
          const chunk = withGeometry.slice(i, i + BATCH_SIZE);

          try {
            const inserted = await insertFeatureBatch(insertedLayer.id, chunk);
            importedCount += inserted;
          } catch (batchErr) {
            await callbacks.onLog(
              `  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, retrying row-by-row: ${truncateError(batchErr)}`,
            );

            for (const feature of chunk) {
              try {
                importedCount += await insertFeatureBatch(insertedLayer.id, [
                  feature,
                ]);
              } catch (rowErr) {
                skippedCount += 1;
                if (skippedCount <= 3) {
                  await callbacks.onLog(
                    `  Skipped invalid feature: ${truncateError(rowErr, 120)}`,
                  );
                }
              }
            }
          }

          progress[layerIdx].imported = importedCount;
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(totalFeatures / BATCH_SIZE);

          if (
            batchNum === totalBatches ||
            batchNum % 10 === 0 ||
            totalBatches <= 3
          ) {
            const pct = Math.round((importedCount / totalFeatures) * 100);
            await callbacks.onLog(
              `  PostGIS batch ${batchNum}/${totalBatches}: ${importedCount}/${totalFeatures} features (${pct}%)`,
            );
            await callbacks.onProgress(
              [...progress],
              layerPct + Math.floor((importedCount / totalFeatures) * 2),
              `Importing ${meta.name}: ${importedCount}/${totalFeatures} features`,
            );
          }
        }

        if (skippedCount > 3) {
          await callbacks.onLog(
            `  ${skippedCount} feature(s) skipped due to invalid geometry`,
          );
        }
      }

      if (importedCount === 0 && totalFeatures > 0) {
        throw new Error("No features could be imported — check geometry validity");
      }

      await db
        .update(gisLayers)
        .set({ featureCount: importedCount })
        .where(eq(gisLayers.id, insertedLayer.id));

      progress[layerIdx].status = "imported";
      progress[layerIdx].imported = importedCount;
      await callbacks.onLog(
        `  ✓ Layer imported: ${meta.name} — ${importedCount} features in PostGIS`,
      );
    } catch (err) {
      const message = truncateError(err);
      progress[layerIdx].status = "failed";
      progress[layerIdx].error = message;

      if (insertedLayerId) {
        await db
          .delete(gisLayerFeatures)
          .where(eq(gisLayerFeatures.layerId, insertedLayerId));
        await db.delete(gisLayers).where(eq(gisLayers.id, insertedLayerId));
      }

      await callbacks.onLog(`  ✗ Layer failed: ${meta.name} — ${message}`);
    }
  }

  const imported = progress.filter((l) => l.status === "imported").length;
  const failed = progress.filter((l) => l.status === "failed").length;

  await callbacks.onLog(
    `PostGIS import finished — ${imported} succeeded, ${failed} failed`,
  );
  await callbacks.onProgress(
    [...progress],
    98,
    failed > 0
      ? `Imported ${imported}/${totalLayers} layers (${failed} failed)`
      : `Imported ${imported}/${totalLayers} layers into PostGIS`,
  );

  return progress;
}
