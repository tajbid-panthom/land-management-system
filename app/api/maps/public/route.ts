import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gisMaps, gisLayers } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import {
  areAllLayersHidden,
  resolveLayerVisibility,
} from "@/lib/gis-maps/layer-visibility";

/**
 * Public read-only map catalog for the parcel search page.
 * Does not require GIS admin — only returns ready maps.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mapId = url.searchParams.get("mapId");

  if (mapId) {
    const layers = await db
      .select({
        id: gisLayers.id,
        layerName: gisLayers.layerName,
        geometryType: gisLayers.geometryType,
        featureCount: gisLayers.featureCount,
        visible: gisLayers.visible,
        styleJson: gisLayers.styleJson,
        sortOrder: gisLayers.sortOrder,
      })
      .from(gisLayers)
      .where(eq(gisLayers.mapId, mapId))
      .orderBy(gisLayers.sortOrder, gisLayers.layerName);

    const allHidden = areAllLayersHidden(layers);
    return NextResponse.json({
      layers: layers.map((layer) => ({
        ...layer,
        visible: resolveLayerVisibility(layer, allHidden),
      })),
    });
  }

  const maps = await db
    .select({
      id: gisMaps.id,
      name: gisMaps.name,
      slug: gisMaps.slug,
      status: gisMaps.status,
      layerCount: sql<number>`(
        SELECT COUNT(*)::int FROM gis_layers WHERE map_id = ${gisMaps.id}
      )`,
      bbox: gisMaps.bbox,
    })
    .from(gisMaps)
    .where(eq(gisMaps.status, "ready"))
    .orderBy(desc(gisMaps.createdAt))
    .limit(20);

  return NextResponse.json({ maps });
}
