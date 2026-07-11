import { NextRequest, NextResponse } from "next/server";
import { ilike, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { owners } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { encryptField } from "@/lib/crypto/encryption";
import { createOwnerSchema } from "@/lib/owners/validations";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = request.nextUrl.searchParams.get("search");
  const conditions = [isNull(owners.deletedAt)];
  if (search) {
    conditions.push(ilike(owners.fullName, `%${search}%`));
  }

  const rows = await db
    .select({
      id: owners.id,
      fullName: owners.fullName,
      phone: owners.phone,
      email: owners.email,
      ownerType: owners.ownerType,
      createdAt: owners.createdAt,
    })
    .from(owners)
    .where(and(...conditions))
    .limit(100);

  return NextResponse.json({ owners: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createOwnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [owner] = await db
    .insert(owners)
    .values({
      fullName: parsed.data.fullName,
      fatherOrHusbandName: parsed.data.fatherOrHusbandName,
      motherName: parsed.data.motherName,
      dateOfBirth: parsed.data.dateOfBirth,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      ownerType: parsed.data.ownerType,
      nidNumberEncrypted: parsed.data.nid
        ? encryptField(parsed.data.nid)
        : undefined,
    })
    .returning({
      id: owners.id,
      fullName: owners.fullName,
      fatherOrHusbandName: owners.fatherOrHusbandName,
      motherName: owners.motherName,
      dateOfBirth: owners.dateOfBirth,
      phone: owners.phone,
      email: owners.email,
      address: owners.address,
      ownerType: owners.ownerType,
      createdAt: owners.createdAt,
    });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entityTable: "owners",
    entityId: owner.id,
    newValue: {
      fullName: owner.fullName,
      phone: owner.phone,
      email: owner.email,
      ownerType: owner.ownerType,
    },
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ owner }, { status: 201 });
}
