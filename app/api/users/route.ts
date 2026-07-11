import { NextRequest, NextResponse } from "next/server";
import { eq, ilike, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { createUserSchema } from "@/lib/users/validations";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = request.nextUrl.searchParams.get("search");
  const conditions = [];
  if (search) {
    conditions.push(ilike(users.name, `%${search}%`));
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(100);

  return NextResponse.json({ users: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      isActive: parsed.data.isActive ? "true" : "false",
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entityTable: "users",
    entityId: user.id,
    newValue: {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ user }, { status: 201 });
}
