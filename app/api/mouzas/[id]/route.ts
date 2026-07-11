import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mouzas } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canEditParcels } from "@/lib/auth/rbac";
import { createMouzaSchema } from "@/lib/mouza-gis/validations";
import { writeAuditLog } from "@/lib/audit/log";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const [mouza] = await db
    .select()
    .from(mouzas)
    .where(eq(mouzas.id, id))
    .limit(1);

  if (!mouza) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ mouza });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id || !canEditParcels(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = createMouzaSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [mouza] = await db
    .update(mouzas)
    .set(parsed.data)
    .where(eq(mouzas.id, id))
    .returning();

  if (!mouza) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "update",
    entityTable: "mouzas",
    entityId: mouza.id,
    newValue: mouza as unknown as Record<string, unknown>,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ mouza });
}
