import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mouzas, mouzaGisRecords } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canEditParcels, isPropertyAdmin } from "@/lib/auth/rbac";
import { createMouzaSchema } from "@/lib/mouza-gis/validations";
import { writeAuditLog } from "@/lib/audit/log";
import { cleanupMouzaSync, rebuildMouzaBoundary } from "@/lib/mouza-gis/sync-service";

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

  if (parsed.data.name || parsed.data.mCode || parsed.data.jlNumber) {
    await db
      .update(mouzaGisRecords)
      .set({
        mauza: parsed.data.name ?? undefined,
        mCode: parsed.data.mCode ?? undefined,
        jlNo: parsed.data.jlNumber ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(mouzaGisRecords.mouzaId, id));

    await rebuildMouzaBoundary(id);
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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const [existing] = await db
    .select({ id: mouzas.id })
    .from(mouzas)
    .where(eq(mouzas.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await cleanupMouzaSync(id);

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "delete",
    entityTable: "mouzas",
    entityId: id,
    ipAddress:
      _request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ success: true });
}
