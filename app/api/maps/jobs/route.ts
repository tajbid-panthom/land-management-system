import { NextResponse } from "next/server";
import { listJobs } from "@/lib/gis-maps/queries";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";
import { getTileServerBaseUrl, isTileServerConfigured } from "@/lib/gis-maps/tiles";

export async function GET() {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const jobs = await listJobs(100);

  return NextResponse.json({
    jobs,
    tileServer: {
      configured: isTileServerConfigured(),
      url: getTileServerBaseUrl(),
    },
  });
}
