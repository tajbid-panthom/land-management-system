import { NextResponse } from "next/server";
import { getJobById, getMapById } from "@/lib/gis-maps/queries";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";
import { statusLabel } from "@/lib/gis-maps/constants";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const { jobId } = await params;
  const job = await getJobById(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const map = await getMapById(job.mapId);

  const result = job.result as { layersProgress?: unknown[] } | null;

  return NextResponse.json({
    jobId: job.id,
    mapId: job.mapId,
    status: statusLabel(job.status),
    progress: job.progress,
    message: job.message,
    errorMessage: job.errorMessage,
    logs: map?.processingLog ?? [],
    layersProgress: result?.layersProgress ?? [],
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
}
