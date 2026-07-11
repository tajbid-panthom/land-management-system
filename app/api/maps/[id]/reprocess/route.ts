import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gisProcessingJobs } from "@/lib/db/schema";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";
import { getMapById } from "@/lib/gis-maps/queries";
import { reprocessMap } from "@/lib/gis-maps/process-runner";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(
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

  const [job] = await db
    .insert(gisProcessingJobs)
    .values({
      mapId: id,
      status: "queued",
      progress: 0,
      message: "Reprocess queued",
    })
    .returning();

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "update",
    entityTable: "gis_maps",
    entityId: id,
    newValue: { action: "reprocess", jobId: job.id },
  });

  void reprocessMap(id, job.id);

  return NextResponse.json({ jobId: job.id, status: "queued" });
}
