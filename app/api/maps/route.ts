import { NextResponse } from "next/server";
import { listMaps } from "@/lib/gis-maps/queries";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";

export async function GET() {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const maps = await listMaps(100);
  return NextResponse.json({ maps });
}
