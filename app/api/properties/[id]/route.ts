import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  properties,
  propertyLocations,
  landParcels,
  khatians,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  canPerformPropertyAction,
} from "@/lib/auth/property-permissions";
import { isPropertyOwner } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import {
  updatePropertySchema,
} from "@/lib/properties/validations";
import {
  getPropertyDetail,
  userOwnsProperty,
} from "@/lib/properties/queries";
import { convertAreaToAllUnits } from "@/lib/properties/utils";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
}

async function authorizeView(
  session: { user: { id: string; role: import("@/lib/auth/rbac").Role } },
  propertyId: string,
) {
  if (canPerformPropertyAction(session.user.role, "view_details")) {
    if (isPropertyOwner(session.user.role)) {
      return userOwnsProperty(session.user.id, propertyId);
    }
    return true;
  }
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await authorizeView(session, id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getPropertyDetail(id);
  if (!data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !canPerformPropertyAction(session.user.role, "edit")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getPropertyDetail(id);
  if (!existing) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Partial<typeof properties.$inferInsert> = {
    updatedBy: session.user.id,
    updatedAt: new Date(),
  };
  if (parsed.data.status) updates.status = parsed.data.status;

  await db.transaction(async (tx) => {
    if (Object.keys(updates).length > 2) {
      await tx.update(properties).set(updates).where(eq(properties.id, id));
    }

    if (parsed.data.location) {
      const loc = parsed.data.location;
      const locUpdates: Record<string, unknown> = { updatedAt: new Date() };
      if (loc.plotNumber) locUpdates.plotNumber = loc.plotNumber;
      if (loc.mouzaId) locUpdates.mouzaId = loc.mouzaId;
      if (loc.mouzaName) locUpdates.mouzaName = loc.mouzaName;
      if (loc.jlNumber) locUpdates.jlNumber = loc.jlNumber;
      if (loc.khatianCs) locUpdates.khatianCs = loc.khatianCs;
      if (loc.khatianSa) locUpdates.khatianSa = loc.khatianSa;
      if (loc.khatianRs) locUpdates.khatianRs = loc.khatianRs;
      if (loc.khatianBs) locUpdates.khatianBs = loc.khatianBs;

      if (loc.areaValue && loc.areaUnit) {
        const areas = convertAreaToAllUnits(
          parseFloat(loc.areaValue),
          loc.areaUnit,
        );
        locUpdates.areaDecimal = areas.decimal;
        locUpdates.areaAcre = areas.acre;
        locUpdates.areaHectare = areas.hectare;
        locUpdates.areaSqft = areas.sqft;

        await tx
          .update(landParcels)
          .set({
            areaValue: loc.areaValue,
            areaUnit: loc.areaUnit,
            plotNumber: loc.plotNumber ?? existing.property.plotNumber,
            updatedAt: new Date(),
          })
          .where(eq(landParcels.id, existing.property.parcelId));
      }

      await tx
        .update(propertyLocations)
        .set(locUpdates)
        .where(eq(propertyLocations.propertyId, id));

      const khatianMap = [
        { type: "CS" as const, number: loc.khatianCs },
        { type: "SA" as const, number: loc.khatianSa },
        { type: "RS" as const, number: loc.khatianRs },
        { type: "BS" as const, number: loc.khatianBs },
      ];

      for (const k of khatianMap) {
        if (!k.number) continue;
        const [existingK] = await tx
          .select()
          .from(khatians)
          .where(
            and(
              eq(khatians.parcelId, existing.property.parcelId),
              eq(khatians.khatianType, k.type),
            ),
          )
          .limit(1);
        if (existingK) {
          await tx
            .update(khatians)
            .set({ khatianNumber: k.number })
            .where(eq(khatians.id, existingK.id));
        } else {
          await tx.insert(khatians).values({
            parcelId: existing.property.parcelId,
            khatianType: k.type,
            khatianNumber: k.number,
          });
        }
      }
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "update",
    entityTable: "properties",
    entityId: id,
    previousValue: existing.property as unknown as Record<string, unknown>,
    newValue: parsed.data as Record<string, unknown>,
    ipAddress: clientIp(request),
  });

  const updated = await getPropertyDetail(id);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !canPerformPropertyAction(session.user.role, "delete")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  await db
    .update(properties)
    .set({ deletedAt: new Date(), updatedBy: session.user.id })
    .where(eq(properties.id, id));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "delete",
    entityTable: "properties",
    entityId: id,
    previousValue: property as unknown as Record<string, unknown>,
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ success: true });
}
