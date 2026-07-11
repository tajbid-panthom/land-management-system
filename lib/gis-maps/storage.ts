import { mkdir, writeFile, readFile, rm, stat } from "fs/promises";
import { join } from "path";

const UPLOAD_ROOT = join(process.cwd(), "uploads");

export function getUploadPaths(mapId: string) {
  return {
    root: join(UPLOAD_ROOT, mapId),
    original: join(UPLOAD_ROOT, mapId, "original"),
    extracted: join(UPLOAD_ROOT, mapId, "extracted"),
    processed: join(UPLOAD_ROOT, mapId, "processed"),
  };
}

export async function ensureUploadDirs(mapId: string) {
  const paths = getUploadPaths(mapId);
  await mkdir(paths.original, { recursive: true });
  await mkdir(paths.extracted, { recursive: true });
  await mkdir(paths.processed, { recursive: true });
  return paths;
}

export async function saveOriginalFile(
  mapId: string,
  fileName: string,
  buffer: Buffer,
) {
  const paths = await ensureUploadDirs(mapId);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = join(paths.original, safeName);
  await writeFile(filePath, buffer);
  return { filePath, safeName };
}

export async function readManifest(mapId: string) {
  const manifestPath = join(
    getUploadPaths(mapId).processed,
    "manifest.json",
  );
  const raw = await readFile(manifestPath, "utf-8");
  return JSON.parse(raw) as {
    layers: Array<{
      layer_name: string;
      table_name: string;
      geojson_path: string;
      geometry?: string;
      features?: number;
      bbox?: [number, number, number, number];
      style_json?: Record<string, unknown>;
      sort_order?: number;
    }>;
    bbox?: [number, number, number, number];
  };
}

export async function deleteMapFiles(mapId: string) {
  const root = join(UPLOAD_ROOT, mapId);
  await rm(root, { recursive: true, force: true });
}

export async function getFileSize(filePath: string): Promise<number> {
  const info = await stat(filePath);
  return info.size;
}

export function slugifyMapName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 80) || "map";
}
