import { spawn } from "child_process";
import { mkdir, readdir, readFile, rm, stat } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import JSZip from "jszip";

const ZIP_MAGIC = [0x50, 0x4b]; // PK
const SEVEN_ZIP_MAGIC = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]; // 7z

export type ArchiveType = "zip" | "7z" | "unknown";

export function detectArchiveType(buffer: Buffer): ArchiveType {
  if (buffer.length >= 2 && buffer[0] === ZIP_MAGIC[0] && buffer[1] === ZIP_MAGIC[1]) {
    return "zip";
  }
  if (
    buffer.length >= 6 &&
    SEVEN_ZIP_MAGIC.every((byte, index) => buffer[index] === byte)
  ) {
    return "7z";
  }
  return "unknown";
}

async function extract7zWithPython(
  sourcePath: string,
  destDir: string,
): Promise<void> {
  await mkdir(destDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "-c",
        [
          "from pathlib import Path",
          "from extract import _extract_archive_to_dir, _extract_nested_archives",
          `src = Path(${JSON.stringify(sourcePath)})`,
          `dest = Path(${JSON.stringify(destDir)})`,
          "dest.mkdir(parents=True, exist_ok=True)",
          "_extract_archive_to_dir(src, dest)",
          "_extract_nested_archives(dest)",
        ].join("; "),
      ],
      { cwd: join(process.cwd(), "python") },
    );

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            stderr.trim() ||
              "7-Zip extraction failed. Run: pip install -r python/requirements.txt",
          ),
        );
      }
    });
    child.on("error", reject);
  });
}

async function walkShapefilePairs(
  rootDir: string,
): Promise<Array<{ baseName: string; shp: Buffer; dbf: Buffer; relPath: string }>> {
  const shpFiles = new Map<string, string>();
  const dbfFiles = new Map<string, string>();

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
      const key = fullPath.slice(0, fullPath.lastIndexOf("."));
      if (ext === ".shp") shpFiles.set(key, fullPath);
      if (ext === ".dbf") dbfFiles.set(key, fullPath);
    }
  }

  await walk(rootDir);

  const pairs: Array<{
    baseName: string;
    shp: Buffer;
    dbf: Buffer;
    relPath: string;
  }> = [];

  for (const [key, shpPath] of shpFiles) {
    const dbfPath = dbfFiles.get(key);
    if (!dbfPath) continue;
    pairs.push({
      baseName: basename(key),
      shp: await readFile(shpPath),
      dbf: await readFile(dbfPath),
      relPath: key,
    });
  }

  return pairs;
}

export async function findShapefilePairsInZipBuffer(
  zipBuffer: Buffer,
): Promise<Array<{ baseName: string; shp: Buffer; dbf: Buffer }>> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const byBase = new Map<string, Partial<Record<".shp" | ".dbf", Buffer>>>();

  for (const path of files) {
    const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
    if (ext !== ".shp" && ext !== ".dbf") continue;

    const slash = path.lastIndexOf("/");
    const fileName = slash >= 0 ? path.slice(slash + 1) : path;
    const baseKey = fileName.slice(0, fileName.lastIndexOf("."));
    const buffer = Buffer.from(await zip.files[path].async("arraybuffer"));

    const existing = byBase.get(baseKey) ?? {};
    existing[ext as ".shp" | ".dbf"] = buffer;
    byBase.set(baseKey, existing);
  }

  const pairs: Array<{ baseName: string; shp: Buffer; dbf: Buffer }> = [];
  for (const [baseKey, parts] of byBase) {
    if (parts[".shp"] && parts[".dbf"]) {
      pairs.push({
        baseName: baseKey,
        shp: parts[".shp"],
        dbf: parts[".dbf"],
      });
    }
  }

  return pairs;
}

export async function extractAndFindShapefilePairs(
  sourcePath: string,
): Promise<Array<{ baseName: string; shp: Buffer; dbf: Buffer }>> {
  const buffer = await readFile(sourcePath);
  const archiveType = detectArchiveType(buffer);

  if (archiveType === "zip") {
    const pairs = await findShapefilePairsInZipBuffer(buffer);
    if (pairs.length > 0) return pairs;
  }

  if (archiveType === "7z" || archiveType === "unknown") {
    const tempDir = join(tmpdir(), `gis-extract-${randomUUID()}`);
    try {
      await extract7zWithPython(sourcePath, tempDir);
      const pairs = await walkShapefilePairs(tempDir);
      if (pairs.length > 0) {
        return pairs.map(({ baseName, shp, dbf }) => ({ baseName, shp, dbf }));
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  if (archiveType === "zip") {
    return findShapefilePairsInZipBuffer(buffer);
  }

  throw new Error(
    "No shapefile layers found. ArcGIS .mpk files use 7-Zip compression — " +
      "ensure Python dependencies are installed: pip install -r python/requirements.txt",
  );
}

export async function isSevenZipArchive(filePath: string): Promise<boolean> {
  const buffer = await readFile(filePath);
  return detectArchiveType(buffer) === "7z";
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
