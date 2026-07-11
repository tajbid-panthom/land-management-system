import { NextRequest, NextResponse } from "next/server";
import { gisSearchSchema } from "@/lib/gis-maps/validations";
import { searchMapFeatures } from "@/lib/gis-maps/queries";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = gisSearchSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const results = await searchMapFeatures(
    parsed.data.q,
    parsed.data.mapId,
    parsed.data.layer,
  );

  return NextResponse.json({ results });
}
