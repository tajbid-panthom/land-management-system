import { NextResponse } from "next/server";
import { findGisLayerFeatureForLocation } from "@/lib/gis-maps/resolve-property";
import { getFeatureById } from "@/lib/gis-maps/queries";

/** Locate a GIS feature by plot + mauza for the public search map. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const plotNo = url.searchParams.get("plotNo");
  const mauza = url.searchParams.get("mauza");
  const district = url.searchParams.get("district");
  const upazila = url.searchParams.get("upazila");

  if (!plotNo) {
    return NextResponse.json({ error: "plotNo is required" }, { status: 400 });
  }

  const match = await findGisLayerFeatureForLocation({
    plotNumber: plotNo,
    mouzaName: mauza,
    districtName: district,
    upazilaName: upazila,
  });

  if (!match) {
    return NextResponse.json({ match: null });
  }

  const feature = await getFeatureById(match.featureId);
  let geometry: unknown = null;
  if (feature?.geojson) {
    try {
      geometry = JSON.parse(feature.geojson);
    } catch {
      geometry = null;
    }
  }

  return NextResponse.json({
    match: {
      ...match,
      geometry,
      layerId: feature?.layer_id ?? match.layerId,
      mapId: match.mapId,
    },
  });
}
