import { NextResponse } from "next/server";
import { getLayerGeoJson } from "@/lib/gis-maps/queries";
import { getVectorTileUrl } from "@/lib/gis-maps/tiles";

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

  const geojson = await getLayerGeoJson(id);
  return NextResponse.json(geojson);
}
