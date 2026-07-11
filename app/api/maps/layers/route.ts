import { NextRequest, NextResponse } from "next/server";
import { getMapLayers, updateLayer } from "@/lib/gis-maps/queries";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";
import { gisLayerStyleSchema } from "@/lib/gis-maps/validations";
import {
  areAllLayersHidden,
  resolveLayerVisibility,
} from "@/lib/gis-maps/layer-visibility";

export async function GET(request: NextRequest) {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const mapId = request.nextUrl.searchParams.get("mapId");
  if (!mapId) {
    return NextResponse.json({ error: "mapId is required" }, { status: 400 });
  }

  const layers = await getMapLayers(mapId);
  const allHidden = areAllLayersHidden(layers);

  return NextResponse.json({
    layers: layers.map((layer) => ({
      ...layer,
      visible: resolveLayerVisibility(layer, allHidden),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = gisLayerStyleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const layerId = body.layerId as string | undefined;
  if (!layerId) {
    return NextResponse.json({ error: "layerId is required" }, { status: 400 });
  }

  const styleJson = { ...(body.styleJson ?? {}) };
  if (parsed.data.color) {
    const paintKey = styleJson.type === "line" ? "line-color" : "fill-color";
    styleJson.paint = {
      ...(styleJson.paint as Record<string, unknown>),
      [paintKey]: parsed.data.color,
    };
  }
  if (parsed.data.opacity !== undefined) {
    const key =
      styleJson.type === "line" ? "line-opacity" : "fill-opacity";
    styleJson.paint = {
      ...(styleJson.paint as Record<string, unknown>),
      [key]: parsed.data.opacity,
    };
  }
  if (parsed.data.lineWidth !== undefined && styleJson.type === "line") {
    styleJson.paint = {
      ...(styleJson.paint as Record<string, unknown>),
      "line-width": parsed.data.lineWidth,
    };
  }

  const updates: Parameters<typeof updateLayer>[1] = {};
  if (parsed.data.visible !== undefined) {
    updates.visible = parsed.data.visible;
  }
  if (
    body.styleJson !== undefined ||
    parsed.data.color !== undefined ||
    parsed.data.opacity !== undefined ||
    parsed.data.lineWidth !== undefined
  ) {
    updates.styleJson = styleJson;
  }

  const layer = await updateLayer(layerId, updates);

  return NextResponse.json({ layer });
}
