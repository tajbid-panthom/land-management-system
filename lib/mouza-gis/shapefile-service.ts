import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import JSZip from "jszip";
import { DBFFile } from "dbffile";
import * as shapefile from "shapefile";
import type { FeatureCollection, Geometry } from "geojson";
import {
  extractDbfMatchKeys,
  normalizeDbfFieldName,
} from "./excel-import";

export type ParsedFeature = {
  attributes: Record<string, unknown>;
  geometry: Geometry | null;
  matchKeys: ReturnType<typeof extractDbfMatchKeys>;
};

export type ShapefileParseResult = {
  features: ParsedFeature[];
  fieldNames: string[];
  geojson: FeatureCollection;
  baseName: string;
  hasGeometry: boolean;
};

export type ExtractedShapefile = {
  shp: Buffer;
  dbf: Buffer;
  shx?: Buffer;
  prj?: string;
  baseName: string;
};

export type ZipExtractResult =
  | { kind: "shapefile"; data: ExtractedShapefile }
  | { kind: "dbf-only"; dbf: Buffer; baseName: string };

const SHAPEFILE_EXTENSIONS = [".shp", ".shx", ".dbf", ".prj"] as const;

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function getBaseName(name: string): string {
  const ext = getExtension(name);
  const base = name.split("/").pop() ?? name;
  return ext ? base.slice(0, -ext.length) : base;
}

/** Extract shapefile components or DBF-only from a ZIP (flat or nested). */
export async function extractFromZip(zipBuffer: Buffer): Promise<ZipExtractResult> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir);

  const components: Partial<
    Record<(typeof SHAPEFILE_EXTENSIONS)[number], { path: string; buffer: Buffer }>
  > = {};

  for (const path of files) {
    const ext = getExtension(path);
    if (
      !SHAPEFILE_EXTENSIONS.includes(ext as (typeof SHAPEFILE_EXTENSIONS)[number])
    ) {
      continue;
    }
    const buffer = Buffer.from(await zip.files[path].async("arraybuffer"));
    components[ext as (typeof SHAPEFILE_EXTENSIONS)[number]] = { path, buffer };
  }

  if (components[".shp"] && components[".dbf"]) {
    return {
      kind: "shapefile",
      data: {
        shp: components[".shp"].buffer,
        dbf: components[".dbf"].buffer,
        shx: components[".shx"]?.buffer,
        prj: components[".prj"]
          ? components[".prj"].buffer.toString("utf-8")
          : undefined,
        baseName: getBaseName(components[".shp"].path),
      },
    };
  }

  if (components[".dbf"]) {
    return {
      kind: "dbf-only",
      dbf: components[".dbf"].buffer,
      baseName: getBaseName(components[".dbf"].path),
    };
  }

  const found =
    files
      .map((f) => getExtension(f) || f.split("/").pop())
      .filter(Boolean)
      .slice(0, 5)
      .join(", ") || "none";

  throw new Error(
    `Archive must contain a .dbf file (found: ${found}). ` +
      "For map boundaries, include .shp + .shx + .dbf + .prj in the ZIP.",
  );
}

/** @deprecated use extractFromZip */
export async function extractShapefileFromZip(
  zipBuffer: Buffer,
): Promise<ExtractedShapefile> {
  const result = await extractFromZip(zipBuffer);
  if (result.kind === "dbf-only") {
    throw new Error(
      "ZIP contains DBF only. Use parseShapefileZip or parseDbfBuffer instead.",
    );
  }
  return result.data;
}

async function readDbfBuffer(dbfBuffer: Buffer): Promise<ShapefileParseResult> {
  const tmpPath = join(tmpdir(), `mouza-gis-${randomUUID()}.dbf`);
  const features: ParsedFeature[] = [];
  const fieldNameSet = new Set<string>();

  try {
    await writeFile(tmpPath, dbfBuffer);
    const dbf = await DBFFile.open(tmpPath, { readMode: "loose" });

    for (const field of dbf.fields) {
      fieldNameSet.add(normalizeDbfFieldName(field.name));
    }

    for await (const record of dbf) {
      const props = record as Record<string, unknown>;
      features.push({
        attributes: props,
        geometry: null,
        matchKeys: extractDbfMatchKeys(props),
      });
    }
  } finally {
    await unlink(tmpPath).catch(() => undefined);
  }

  return {
    features,
    fieldNames: [...fieldNameSet],
    geojson: toFeatureCollection(features),
    baseName: "dbf",
    hasGeometry: false,
  };
}

async function readShapefilePair(
  shpBuffer: Buffer,
  dbfBuffer: Buffer,
): Promise<ShapefileParseResult> {
  const features: ParsedFeature[] = [];
  const fieldNameSet = new Set<string>();

  const source = await shapefile.open(shpBuffer, dbfBuffer);
  let result = await source.read();

  while (!result.done) {
    const props = (result.value.properties ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(props)) {
      fieldNameSet.add(normalizeDbfFieldName(key));
    }
    features.push({
      attributes: props,
      geometry: result.value.geometry ?? null,
      matchKeys: extractDbfMatchKeys(props),
    });
    result = await source.read();
  }

  return {
    features,
    fieldNames: [...fieldNameSet],
    geojson: toFeatureCollection(features),
    baseName: "shapefile",
    hasGeometry: features.some((f) => f.geometry !== null),
  };
}

export function toFeatureCollection(features: ParsedFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      .filter((f) => f.geometry)
      .map((f) => ({
        type: "Feature" as const,
        properties: f.attributes,
        geometry: f.geometry!,
      })),
  };
}

/** Parse a standalone .dbf file (attributes only, no geometry). */
export async function parseDbfBuffer(
  dbfBuffer: Buffer,
  baseName = "dbf",
): Promise<ShapefileParseResult> {
  const parsed = await readDbfBuffer(dbfBuffer);
  return { ...parsed, baseName };
}

/** Parse upload by extension: .dbf, .zip (dbf-only or full shapefile). */
export async function parseGisFile(
  buffer: Buffer,
  fileName: string,
): Promise<ShapefileParseResult> {
  const ext = getExtension(fileName);

  if (ext === ".dbf") {
    return parseDbfBuffer(buffer, getBaseName(fileName));
  }

  if (ext === ".zip") {
    return parseShapefileZip(buffer);
  }

  throw new Error(
    "Unsupported file type. Upload a .dbf file or a .zip containing shapefile components.",
  );
}

/** Parse a ZIP: full shapefile or DBF-only. */
export async function parseShapefileZip(
  zipBuffer: Buffer,
): Promise<ShapefileParseResult> {
  const extracted = await extractFromZip(zipBuffer);

  if (extracted.kind === "dbf-only") {
    return parseDbfBuffer(extracted.dbf, extracted.baseName);
  }

  const parsed = await readShapefilePair(extracted.data.shp, extracted.data.dbf);
  return {
    ...parsed,
    baseName: extracted.data.baseName,
  };
}

export type LegacyUploadFiles = {
  dbf?: Buffer;
  shp?: Buffer;
  fileName: string;
};

/** Separate .dbf and/or .shp uploads from multipart form. */
export async function parseLegacyShapefileUpload(
  files: LegacyUploadFiles,
): Promise<ShapefileParseResult> {
  if (files.shp && files.dbf) {
    const parsed = await readShapefilePair(files.shp, files.dbf);
    return { ...parsed, baseName: getBaseName(files.fileName) };
  }
  if (files.dbf) {
    return parseDbfBuffer(files.dbf, getBaseName(files.fileName));
  }
  throw new Error("Provide a .dbf file or both .shp and .dbf files.");
}

export function geometryToWkt(geometry: Geometry): string | null {
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates
      .map(
        (ring) =>
          `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`,
      )
      .join(", ");
    return `POLYGON(${rings})`;
  }
  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates
      .map((poly) => {
        const rings = poly
          .map(
            (ring) =>
              `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`,
          )
          .join(", ");
        return `(${rings})`;
      })
      .join(", ");
    return `MULTIPOLYGON(${polys})`;
  }
  return null;
}
