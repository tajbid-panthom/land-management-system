import { NextResponse } from "next/server";
import { getFeatureById } from "@/lib/gis-maps/queries";

/** Public read of a single GIS feature geometry (for search highlight). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const feature = await getFeatureById(id);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  let geometry: unknown = null;
  try {
    geometry = feature.geojson ? JSON.parse(feature.geojson) : null;
  } catch {
    geometry = null;
  }

  return NextResponse.json({
    id: feature.id,
    layerId: feature.layer_id,
    layerName: feature.layer_name,
    geometryType: feature.geometry_type,
    properties: feature.properties,
    geometry,
  });
}
