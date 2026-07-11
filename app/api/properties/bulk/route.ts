import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { bulkActionSchema } from "@/lib/properties/validations";
import { listProperties } from "@/lib/properties/queries";
import { toCsv } from "@/lib/properties/utils";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !canPerformPropertyAction(session.user.role, "bulk_operations")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = bulkActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { action, ids, format } = parsed.data;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;

  if (action === "delete") {
    await db
      .update(properties)
      .set({ deletedAt: new Date(), updatedBy: session.user.id })
      .where(inArray(properties.id, ids));

    for (const id of ids) {
      await writeAuditLog({
        actorUserId: session.user.id,
        action: "delete",
        entityTable: "properties",
        entityId: id,
        ipAddress: ip,
      });
    }

    return NextResponse.json({ success: true, count: ids.length });
  }

  if (action === "restore") {
    await db
      .update(properties)
      .set({
        deletedAt: null,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(inArray(properties.id, ids));

    return NextResponse.json({ success: true, count: ids.length });
  }

  const rows = await db
    .select({
      id: properties.id,
      propertyCode: properties.propertyCode,
      status: properties.status,
      createdAt: properties.createdAt,
    })
    .from(properties)
    .where(inArray(properties.id, ids));

  if (format === "csv") {
    const csv = toCsv(rows as unknown as Record<string, unknown>[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="properties-export.csv"',
      },
    });
  }

  return NextResponse.json({ items: rows });
}
