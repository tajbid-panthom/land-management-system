import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  owners,
  ownershipRecords,
  coOwners,
  ownershipHistory,
  inheritanceInformation,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { ownershipUpdateSchema } from "@/lib/properties/validations";
import {
  getPropertyDetail,
  userOwnsProperty,
} from "@/lib/properties/queries";
import { encryptField } from "@/lib/crypto/encryption";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (
    !canPerformPropertyAction(session.user.role, "view_ownership") &&
    !(await userOwnsProperty(session.user.id, id))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getPropertyDetail(id);
  if (!data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({
    ownership: data.ownership,
    coOwners: data.coOwners,
    history: data.ownershipHistory,
    inheritance: data.inheritance,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const { id } = await params;

  const canEdit =
    canPerformPropertyAction(session?.user?.role ?? "public_user", "update_ownership") &&
    (isPropertyAdmin(session!.user.role) ||
      (await userOwnsProperty(session!.user.id, id)));

  if (!session?.user?.id || !canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getPropertyDetail(id);
  if (!existing) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = ownershipUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(ownershipRecords)
      .set({ isCurrent: false, effectiveTo: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          eq(ownershipRecords.parcelId, existing.property.parcelId),
          eq(ownershipRecords.isCurrent, true),
        ),
      );

    for (const ownerInput of parsed.data.owners) {
      const [owner] = await tx
        .insert(owners)
        .values({
          fullName: ownerInput.fullName,
          fatherOrHusbandName: ownerInput.fatherOrHusbandName,
          motherName: ownerInput.motherName,
          dateOfBirth: ownerInput.dateOfBirth,
          phone: ownerInput.phone,
          email: ownerInput.email,
          nidNumberEncrypted: ownerInput.nid
            ? encryptField(ownerInput.nid)
            : undefined,
        })
        .returning();

      await tx.insert(ownershipRecords).values({
        parcelId: existing.property.parcelId,
        ownerId: owner.id,
        sharePercentage: String(ownerInput.sharePercentage),
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isCurrent: true,
        verificationStatus: "pending",
      });
    }

    if (parsed.data.coOwners) {
      await tx
        .update(coOwners)
        .set({ isCurrent: false, deletedAt: new Date() })
        .where(eq(coOwners.propertyId, id));

      for (const co of parsed.data.coOwners) {
        await tx.insert(coOwners).values({
          propertyId: id,
          ownerId: co.ownerId,
          name: co.name,
          relationship: co.relationship,
          ownershipShare: String(co.ownershipShare),
          isCurrent: true,
        });
      }
    }

    if (parsed.data.history) {
      for (const h of parsed.data.history) {
        await tx.insert(ownershipHistory).values({
          propertyId: id,
          previousOwnerName: h.previousOwnerName,
          transferDate: h.transferDate,
          transferType: h.transferType,
          saleAmount: h.saleAmount,
          recordedBy: session.user.id,
        });
      }
    }

    if (parsed.data.inheritance) {
      const inh = parsed.data.inheritance;
      await tx
        .update(inheritanceInformation)
        .set({
          isApplicable: inh.isApplicable,
          legalHeir: inh.legalHeir,
          courtOrder: inh.courtOrder,
          mutationStatus: inh.mutationStatus,
          updatedAt: new Date(),
        })
        .where(eq(inheritanceInformation.propertyId, id));
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "update",
    entityTable: "ownership_records",
    entityId: id,
    newValue: { ownerCount: parsed.data.owners.length },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  const updated = await getPropertyDetail(id);
  return NextResponse.json({
    ownership: updated?.ownership,
    coOwners: updated?.coOwners,
    history: updated?.ownershipHistory,
    inheritance: updated?.inheritance,
  });
}
