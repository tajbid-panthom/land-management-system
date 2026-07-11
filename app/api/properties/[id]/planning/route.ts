import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planningInformation } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { planningUpdateSchema } from "@/lib/properties/validations";
import { getPropertyDetail } from "@/lib/properties/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canPerformPropertyAction(session.user.role, "view_land_planning")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const data = await getPropertyDetail(id);
  if (!data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({ planning: data.planning });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !canPerformPropertyAction(session.user.role, "view_land_planning")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = planningUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(planningInformation)
    .where(eq(planningInformation.propertyId, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Planning not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(planningInformation)
    .set({
      ...parsed.data,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(planningInformation.propertyId, id))
    .returning();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "update",
    entityTable: "planning_information",
    entityId: updated.id,
    newValue: parsed.data as Record<string, unknown>,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ planning: updated });
}
