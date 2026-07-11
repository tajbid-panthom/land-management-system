import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ownershipRecords } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { canTransitionVerification } from "@/lib/workflows/state-machines";

const transitionSchema = z.object({
  recordId: z.string().uuid(),
  nextStatus: z.enum([
    "pending",
    "under_review",
    "verified",
    "rejected",
    "disputed",
  ]),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [record] = await db
    .select()
    .from(ownershipRecords)
    .where(eq(ownershipRecords.id, parsed.data.recordId))
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  if (
    !canTransitionVerification(
      session.user.role,
      record.verificationStatus ?? "pending",
      parsed.data.nextStatus,
    )
  ) {
    return NextResponse.json(
      { error: "Transition not allowed for your role" },
      { status: 403 },
    );
  }

  const [updated] = await db
    .update(ownershipRecords)
    .set({ verificationStatus: parsed.data.nextStatus })
    .where(eq(ownershipRecords.id, parsed.data.recordId))
    .returning();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "verify",
    entityTable: "ownership_records",
    entityId: record.id,
    previousValue: { verificationStatus: record.verificationStatus },
    newValue: { verificationStatus: parsed.data.nextStatus },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ record: updated });
}
