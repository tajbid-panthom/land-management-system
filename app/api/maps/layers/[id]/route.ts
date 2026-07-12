import { NextResponse } from "next/server";
import { getLayerGeoJson } from "@/lib/gis-maps/queries";
import { getVectorTileUrl } from "@/lib/gis-maps/tiles";
import { parseBBoxParam } from "@/lib/gis-maps/viewport";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "tiles") {
    return NextResponse.json({
      tiles: getVectorTileUrl(`gis_layer_${id}`),
    });
  }

  const bbox = parseBBoxParam(url.searchParams.get("bbox"));
  const zoomRaw = url.searchParams.get("zoom");
  const zoom = zoomRaw != null ? Number(zoomRaw) : undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw != null ? Number(limitRaw) : undefined;

  const geojson = await getLayerGeoJson(id, {
    bbox: bbox ?? undefined,
    zoom: Number.isFinite(zoom) ? zoom : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return NextResponse.json(geojson);
}
