import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { getUserProfile } from "@/lib/profile/queries";
import { updateProfileSchema } from "@/lib/profile/validations";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
}

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Partial<typeof users.$inferInsert> = {};

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
  }

  if (parsed.data.newPassword) {
    if (!existing.passwordHash) {
      return NextResponse.json(
        { error: "Password cannot be changed for this account" },
        { status: 400 },
      );
    }

    const valid = await bcrypt.compare(
      parsed.data.currentPassword!,
      existing.passwordHash,
    );
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    updates.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, session.user.id));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "update",
    entityTable: "users",
    entityId: session.user.id,
    previousValue: { name: existing.name },
    newValue: {
      name: updates.name ?? existing.name,
      passwordChanged: Boolean(parsed.data.newPassword),
    },
    ipAddress: clientIp(request),
  });

  const profile = await getUserProfile(session.user.id);
  return NextResponse.json(profile);
}
