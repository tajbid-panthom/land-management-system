import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { owners, ownershipRecords } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { encryptField } from "@/lib/crypto/encryption";
import { updateOwnerSchema } from "@/lib/owners/validations";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
}

async function getActiveOwner(id: string) {
  const [owner] = await db
    .select()
    .from(owners)
    .where(and(eq(owners.id, id), isNull(owners.deletedAt)))
    .limit(1);
  return owner ?? null;
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
  const owner = await getActiveOwner(id);
  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  return NextResponse.json({
    owner: {
      id: owner.id,
      fullName: owner.fullName,
      fatherOrHusbandName: owner.fatherOrHusbandName,
      motherName: owner.motherName,
      dateOfBirth: owner.dateOfBirth,
      phone: owner.phone,
      email: owner.email,
      address: owner.address,
      ownerType: owner.ownerType,
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
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
  const existing = await getActiveOwner(id);
  if (!existing) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateOwnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Partial<typeof owners.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.data.fullName !== undefined) updates.fullName = parsed.data.fullName;
  if (parsed.data.fatherOrHusbandName !== undefined) {
    updates.fatherOrHusbandName = parsed.data.fatherOrHusbandName;
  }
  if (parsed.data.motherName !== undefined) {
    updates.motherName = parsed.data.motherName;
  }
  if (parsed.data.dateOfBirth !== undefined) {
    updates.dateOfBirth = parsed.data.dateOfBirth;
  }
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.address !== undefined) updates.address = parsed.data.address;
  if (parsed.data.ownerType !== undefined) {
    updates.ownerType = parsed.data.ownerType;
  }
  if (parsed.data.nid !== undefined) {
    updates.nidNumberEncrypted = parsed.data.nid
      ? encryptField(parsed.data.nid)
      : null;
  }

  const [updated] = await db
    .update(owners)
    .set(updates)
    .where(eq(owners.id, id))
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
      updatedAt: owners.updatedAt,
    });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "update",
    entityTable: "owners",
    entityId: id,
    previousValue: {
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.email,
      ownerType: existing.ownerType,
    },
    newValue: parsed.data as Record<string, unknown>,
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ owner: updated });
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
  const existing = await getActiveOwner(id);
  if (!existing) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  const [activeOwnership] = await db
    .select({ id: ownershipRecords.id })
    .from(ownershipRecords)
    .where(
      and(eq(ownershipRecords.ownerId, id), eq(ownershipRecords.isCurrent, true)),
    )
    .limit(1);

  if (activeOwnership) {
    return NextResponse.json(
      {
        error:
          "Cannot delete an owner with active property ownership. Remove or transfer ownership first.",
      },
      { status: 409 },
    );
  }

  await db
    .update(owners)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(owners.id, id));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "delete",
    entityTable: "owners",
    entityId: id,
    previousValue: {
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.email,
      ownerType: existing.ownerType,
    },
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ success: true });
}
