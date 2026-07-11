import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationCases } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { canTransitionMutation } from "@/lib/workflows/state-machines";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const transitionSchema = z.object({
  caseId: z.string().uuid(),
  nextStatus: z.enum([
    "not_applied",
    "applied",
    "under_hearing",
    "approved",
    "rejected",
  ]),
  applicantEmail: z.string().email().optional(),
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

  const [mutationCase] = await db
    .select()
    .from(mutationCases)
    .where(eq(mutationCases.id, parsed.data.caseId))
    .limit(1);

  if (!mutationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (
    !canTransitionMutation(
      session.user.role,
      mutationCase.status ?? "not_applied",
      parsed.data.nextStatus,
    )
  ) {
    return NextResponse.json(
      { error: "Transition not allowed for your role" },
      { status: 403 },
    );
  }

  const [updated] = await db
    .update(mutationCases)
    .set({
      status: parsed.data.nextStatus,
      decisionDate:
        parsed.data.nextStatus === "approved" ||
        parsed.data.nextStatus === "rejected"
          ? new Date().toISOString().split("T")[0]
          : mutationCase.decisionDate,
      approvedBy:
        parsed.data.nextStatus === "approved" ||
        parsed.data.nextStatus === "rejected"
          ? session.user.id
          : mutationCase.approvedBy,
    })
    .where(eq(mutationCases.id, parsed.data.caseId))
    .returning();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "transition",
    entityTable: "mutation_cases",
    entityId: mutationCase.id,
    previousValue: { status: mutationCase.status },
    newValue: { status: parsed.data.nextStatus },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  if (
    resend &&
    parsed.data.applicantEmail &&
    (parsed.data.nextStatus === "approved" ||
      parsed.data.nextStatus === "rejected")
  ) {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@landmgmt.local",
      to: parsed.data.applicantEmail,
      subject: `Mutation Case ${mutationCase.caseNumber} — ${parsed.data.nextStatus}`,
      text: `Your mutation case ${mutationCase.caseNumber} has been ${parsed.data.nextStatus}.`,
    });
  }

  return NextResponse.json({ case: updated });
}
