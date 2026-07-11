import { NextResponse } from "next/server";
import { getMapById } from "@/lib/gis-maps/queries";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const map = await getMapById(id);
  if (!map) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  return NextResponse.json({
    logs: map.processingLog ?? [],
    errorMessage: map.errorMessage,
  });
}
