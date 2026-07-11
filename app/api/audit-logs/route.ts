import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 50),
    100,
  );
  const entityTable = request.nextUrl.searchParams.get("entityTable");
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityTable: auditLogs.entityTable,
      entityId: auditLogs.entityId,
      previousValue: auditLogs.previousValue,
      newValue: auditLogs.newValue,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(
      entityTable ? eq(auditLogs.entityTable, entityTable) : undefined,
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ items: rows, page, limit });
}
