import type { FeatureCollection } from "geojson";

export type LayerLoadResult = {
  layerId: string;
  layerName: string;
  geometryType: string | null;
  featureCount: number;
  ok: boolean;
  error?: string;
};

const loggedLayers = new Set<string>();

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/** Log layer load outcome once per layer per session (dev-friendly, not noisy). */
export function logLayerLoadResult(result: LayerLoadResult): void {
  if (loggedLayers.has(result.layerId)) return;
  loggedLayers.add(result.layerId);

  if (process.env.NODE_ENV === "production" && result.ok) return;

  const prefix = `[GIS Map Viewer] ${result.layerName} (${result.layerId.slice(0, 8)})`;

  if (result.ok) {
    if (result.featureCount === 0) {
      console.warn(
        `${prefix}: loaded with 0 features — geometryType=${result.geometryType ?? "unknown"}`,
      );
    } else if (process.env.NODE_ENV !== "production") {
      console.info(
        `${prefix}: ${result.featureCount} features — geometryType=${result.geometryType ?? "unknown"}`,
      );
    }
    return;
  }

  console.error(
    `${prefix}: failed — ${result.error ?? "unknown error"}`,
  );
}

export function summarizeGeoJson(
  layerId: string,
  layerName: string,
  geometryType: string | null,
  geo: FeatureCollection,
  httpStatus?: number,
): LayerLoadResult {
  const featureCount = geo.features?.length ?? 0;
  const ok = httpStatus == null || (httpStatus >= 200 && httpStatus < 300);

  return {
    layerId,
    layerName,
    geometryType,
    featureCount,
    ok,
    error: ok
      ? featureCount === 0
        ? "No features returned from API"
        : undefined
      : `HTTP ${httpStatus}`,
  };
}

export function resetLayerLoadLogs(): void {
  loggedLayers.clear();
}
