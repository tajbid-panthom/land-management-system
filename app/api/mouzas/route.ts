import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mouzas } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canEditParcels } from "@/lib/auth/rbac";
import { createMouzaSchema } from "@/lib/mouza-gis/validations";
import { listMouzaRegistry } from "@/lib/mouza-gis/queries";
import { writeAuditLog } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Number(searchParams.get("limit") ?? "100");

  const rows = await listMouzaRegistry(limit);
  return NextResponse.json({ mouzas: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !canEditParcels(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createMouzaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: mouzas.id })
    .from(mouzas)
    .where(eq(mouzas.jlNumber, parsed.data.jlNumber))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "A mouza with this JL number already exists" },
      { status: 409 },
    );
  }

  const [mouza] = await db
    .insert(mouzas)
    .values({
      name: parsed.data.name,
      jlNumber: parsed.data.jlNumber,
      upazilaId: parsed.data.upazilaId,
      unionId: parsed.data.unionId,
      mCode: parsed.data.mCode,
      datasetId: parsed.data.datasetId,
      nameBn: parsed.data.nameBn,
    })
    .returning();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entityTable: "mouzas",
    entityId: mouza.id,
    newValue: mouza as unknown as Record<string, unknown>,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ mouza }, { status: 201 });
}
