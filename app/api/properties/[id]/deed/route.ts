import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { propertyDeeds, propertyDeedVersions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { deedUpdateSchema } from "@/lib/properties/validations";
import { getPropertyDetail } from "@/lib/properties/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await getPropertyDetail(id);
  if (!data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({
    deed: data.deed,
    versions: data.deedVersions,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !canPerformPropertyAction(session.user.role, "update_deed")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = deedUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(propertyDeeds)
    .where(eq(propertyDeeds.propertyId, id))
    .limit(1);

  const deedData = {
    deedNumber: parsed.data.deedNumber,
    registrationDate: parsed.data.registrationDate,
    mutationCaseNumber: parsed.data.mutationCaseNumber,
    namjariStatus: parsed.data.namjariStatus,
    powerOfAttorney: parsed.data.powerOfAttorney,
    litigationStatus: parsed.data.litigationStatus,
    updatedBy: session.user.id,
    updatedAt: new Date(),
  };

  let deedId: string;
  let version = 1;

  if (existing) {
    deedId = existing.id;
    const [lastVersion] = await db
      .select()
      .from(propertyDeedVersions)
      .where(eq(propertyDeedVersions.propertyDeedId, existing.id))
      .orderBy(desc(propertyDeedVersions.version))
      .limit(1);
    version = (lastVersion?.version ?? 0) + 1;

    await db
      .update(propertyDeeds)
      .set(deedData)
      .where(eq(propertyDeeds.id, existing.id));
  } else {
    const [created] = await db
      .insert(propertyDeeds)
      .values({ propertyId: id, ...deedData })
      .returning();
    deedId = created.id;
  }

  await db.insert(propertyDeedVersions).values({
    propertyDeedId: deedId,
    version,
    ...deedData,
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "update",
    entityTable: "property_deeds",
    entityId: deedId,
    newValue: parsed.data as Record<string, unknown>,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  const [deed] = await db
    .select()
    .from(propertyDeeds)
    .where(eq(propertyDeeds.id, deedId))
    .limit(1);

  return NextResponse.json({ deed, version });
}
