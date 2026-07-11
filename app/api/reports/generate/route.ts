import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { reportJobs } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canEditParcels } from "@/lib/auth/rbac";
import { processReportJob } from "@/lib/jobs/generate-report";

const generateSchema = z.object({
  parcelId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !canEditParcels(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [job] = await db
    .insert(reportJobs)
    .values({
      parcelId: parsed.data.parcelId,
      requestedBy: session.user.id,
      status: "pending",
    })
    .returning();

  // Process asynchronously in background (fire-and-forget for dev; use Queue in production)
  processReportJob(job.id, session.user.email ?? undefined).catch(console.error);

  return NextResponse.json({ jobId: job.id, status: "pending" }, { status: 202 });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const [job] = await db
    .select()
    .from(reportJobs)
    .where(eq(reportJobs.id, jobId))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
