import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { updateUserSchema } from "@/lib/users/validations";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
}

async function getUser(id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await getUser(id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getUser(id);
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.email && parsed.data.email !== existing.email) {
    const [emailTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (emailTaken) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }
  }

  const updates: Partial<typeof users.$inferInsert> = {};

  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) {
    updates.isActive = parsed.data.isActive ? "true" : "false";
  }
  if (parsed.data.password) {
    updates.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
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
    action: "update",
    entityTable: "users",
    entityId: id,
    previousValue: {
      name: existing.name,
      email: existing.email,
      role: existing.role,
      isActive: existing.isActive,
    },
    newValue: {
      name: updated.name,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
    },
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account" },
      { status: 409 },
    );
  }

  const existing = await getUser(id);
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.isActive !== "true") {
    return NextResponse.json(
      { error: "User is already inactive" },
      { status: 409 },
    );
  }

  if (existing.role === "super_admin") {
    const activeSuperAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "super_admin"), eq(users.isActive, "true")));

    if (activeSuperAdmins.length <= 1) {
      return NextResponse.json(
        { error: "Cannot deactivate the last active super admin" },
        { status: 409 },
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: "false" })
    .where(eq(users.id, id))
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
    action: "delete",
    entityTable: "users",
    entityId: id,
    previousValue: {
      name: existing.name,
      email: existing.email,
      role: existing.role,
      isActive: existing.isActive,
    },
    newValue: { isActive: "false" },
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ user: updated });
}
