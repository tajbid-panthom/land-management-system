import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mouzaGisDatasets } from "@/lib/db/schema";
import { findDistrictByName, getDatasetById } from "./queries";
import type { ParsedFeature } from "./shapefile-service";
import { dbfAttributesToDbValues } from "./excel-import";

export function slugifyDatasetName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 80) || "dataset";
}

function inferDatasetMeta(features: ParsedFeature[], fileName: string) {
  const first = features.find((f) => f.attributes && Object.keys(f.attributes).length > 0);
  const values = first ? dbfAttributesToDbValues(first.attributes) : null;
  const district = values?.mDistrict ?? null;
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const name = district ? `${district} Mouza GIS` : `${baseName} Mouza GIS`;
  const slug = slugifyDatasetName(district ?? baseName);
  return { name, slug, district };
}

export async function ensureDatasetForUpload(options: {
  datasetId?: string | null;
  fileName: string;
  features: ParsedFeature[];
}): Promise<{ id: string; created: boolean; name: string }> {
  if (options.datasetId) {
    const existing = await getDatasetById(options.datasetId);
    if (!existing) {
      throw new Error("Dataset not found");
    }
    return { id: existing.id, created: false, name: existing.name };
  }

  const meta = inferDatasetMeta(options.features, options.fileName);
  const [existing] = await db
    .select({ id: mouzaGisDatasets.id, name: mouzaGisDatasets.name })
    .from(mouzaGisDatasets)
    .where(eq(mouzaGisDatasets.slug, meta.slug))
    .limit(1);

  if (existing) {
    return { id: existing.id, created: false, name: existing.name };
  }

  const district = meta.district ? await findDistrictByName(meta.district) : null;

  const [created] = await db
    .insert(mouzaGisDatasets)
    .values({
      name: meta.name,
      slug: meta.slug,
      districtId: district?.id,
      description: `Auto-created from shapefile upload (${options.fileName})`,
    })
    .returning({ id: mouzaGisDatasets.id, name: mouzaGisDatasets.name });

  return { id: created.id, created: true, name: created.name };
}
