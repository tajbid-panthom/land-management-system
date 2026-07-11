import { readFile } from "fs/promises";
import type { FeatureCollection, Geometry } from "geojson";
import {
  parseDbfBuffer,
  parseShapefileZip,
  readShapefilePair,
  type ParsedFeature,
} from "@/lib/mouza-gis/shapefile-service";
import { extractDbfMatchKeys } from "@/lib/mouza-gis/excel-import";
import {
  detectArchiveType,
  extractAndFindShapefilePairs,
  findShapefilePairsInZipBuffer,
} from "./archive-extract";

export type TsProcessedLayer = {
  name: string;
  tableName: string;
  geometryType: string;
  features: ParsedFeature[];
  geojson: FeatureCollection;
};

const PYTHON_ONLY_FORMATS = new Set(["gdb", "gpkg"]);

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function slugify(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 80) || "layer";
}

function geometryTypeFromFeatures(features: ParsedFeature[]): string {
  const geom = features.find((f) => f.geometry)?.geometry;
  return geom?.type ?? "Unknown";
}

function toFeatureCollection(features: ParsedFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      .filter((f) => f.geometry)
      .map((f) => ({
        type: "Feature" as const,
        properties: f.attributes,
        geometry: f.geometry as Geometry,
      })),
  };
}

async function parseGeoJsonBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<TsProcessedLayer[]> {
  const geojson = JSON.parse(buffer.toString("utf-8")) as FeatureCollection;
  const features: ParsedFeature[] = (geojson.features ?? []).map((feature) => {
    const attrs = (feature.properties ?? {}) as Record<string, unknown>;
    return {
      attributes: attrs,
      geometry: feature.geometry ?? null,
      matchKeys: extractDbfMatchKeys(attrs),
    };
  });

  const baseName = fileName.replace(/\.[^.]+$/, "");
  return [
    {
      name: baseName,
      tableName: slugify(baseName),
      geometryType: geometryTypeFromFeatures(features),
      features,
      geojson: toFeatureCollection(features),
    },
  ];
}

async function layersFromShapefilePairs(
  pairs: Array<{ baseName: string; shp: Buffer; dbf: Buffer }>,
): Promise<TsProcessedLayer[]> {
  const layers: TsProcessedLayer[] = [];

  for (const pair of pairs) {
    const parsed = await readShapefilePair(pair.shp, pair.dbf);
    layers.push({
      name: pair.baseName,
      tableName: slugify(pair.baseName),
      geometryType: geometryTypeFromFeatures(parsed.features),
      features: parsed.features,
      geojson: parsed.geojson,
    });
  }

  return layers;
}

async function parseArchiveFile(
  inputPath: string,
  fileName: string,
): Promise<TsProcessedLayer[]> {
  const buffer = await readFile(inputPath);
  const archiveType = detectArchiveType(buffer);

  if (archiveType === "7z") {
    const pairs = await extractAndFindShapefilePairs(inputPath);
    if (pairs.length === 0) {
      throw new Error("No shapefile layers found inside 7-Zip MPK archive.");
    }
    return layersFromShapefilePairs(pairs);
  }

  const zipPairs = await findShapefilePairsInZipBuffer(buffer);
  if (zipPairs.length > 0) {
    return layersFromShapefilePairs(zipPairs);
  }

  const parsed = await parseShapefileZip(buffer);
  return [
    {
      name: parsed.baseName,
      tableName: slugify(parsed.baseName),
      geometryType: geometryTypeFromFeatures(parsed.features),
      features: parsed.features,
      geojson: parsed.geojson,
    },
  ];
}

export function canUseTypeScriptProcessor(fileName: string): boolean {
  const ext = getExtension(fileName);
  return !PYTHON_ONLY_FORMATS.has(ext);
}

export async function processWithTypeScript(
  inputPath: string,
  fileName: string,
): Promise<TsProcessedLayer[]> {
  const ext = getExtension(fileName);
  const buffer = await readFile(inputPath);

  if (ext === "geojson" || ext === "json") {
    return parseGeoJsonBuffer(buffer, fileName);
  }

  if (ext === "dbf") {
    const parsed = await parseDbfBuffer(buffer, fileName.replace(/\.[^.]+$/, ""));
    return [
      {
        name: parsed.baseName,
        tableName: slugify(parsed.baseName),
        geometryType: geometryTypeFromFeatures(parsed.features),
        features: parsed.features,
        geojson: parsed.geojson,
      },
    ];
  }

  if (ext === "zip" || ext === "mpk" || ext === "7z") {
    const layers = await parseArchiveFile(inputPath, fileName);
    if (layers.length === 0) {
      throw new Error("No shapefile layers found in archive.");
    }
    return layers;
  }

  throw new Error(
    `Unsupported file type ".${ext}". Supported: .zip, .mpk (7-Zip), .dbf, .geojson. ` +
      "For .gdb and .gpkg, install Python: pip install -r python/requirements.txt",
  );
}
