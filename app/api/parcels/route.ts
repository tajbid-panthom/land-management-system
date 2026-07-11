import { NextRequest, NextResponse } from "next/server";
import { eq, ilike, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  landParcels,
  mouzas,
  unions,
  upazilas,
  districts,
  khatians,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canEditParcels } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { z } from "zod";

const createParcelSchema = z.object({
  mouzaId: z.string().uuid(),
  plotNumber: z.string().min(1).max(30),
  areaValue: z.string(),
  areaUnit: z.enum([
    "decimal",
    "acre",
    "hectare",
    "sqft",
    "katha",
    "bigha",
  ]),
  status: z
    .enum(["active", "disputed", "acquired", "merged", "split"])
    .optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plotNumber = searchParams.get("plotNumber");
  const mouzaId = searchParams.get("mouzaId");
  const districtId = searchParams.get("districtId");
  const upazilaId = searchParams.get("upazilaId");
  const unionId = searchParams.get("unionId");
  const mouzaName = searchParams.get("mouzaName");
  const jlNumber = searchParams.get("jlNumber");
  const khatianNumber = searchParams.get("khatianNumber");

  const conditions = [];
  if (plotNumber) {
    conditions.push(ilike(landParcels.plotNumber, `%${plotNumber}%`));
  }
  if (mouzaId) {
    conditions.push(eq(landParcels.mouzaId, mouzaId));
  }
  if (districtId) {
    conditions.push(eq(districts.id, districtId));
  }
  if (upazilaId) {
    conditions.push(eq(upazilas.id, upazilaId));
  }
  if (unionId) {
    conditions.push(eq(unions.id, unionId));
  }
  if (mouzaName) {
    conditions.push(ilike(mouzas.name, `%${mouzaName}%`));
  }
  if (jlNumber) {
    conditions.push(ilike(mouzas.jlNumber, `%${jlNumber}%`));
  }
  if (khatianNumber) {
    const matchingKhatians = await db
      .select({ parcelId: khatians.parcelId })
      .from(khatians)
      .where(ilike(khatians.khatianNumber, `%${khatianNumber}%`));

    const parcelIds = [...new Set(matchingKhatians.map((row) => row.parcelId))];
    if (parcelIds.length === 0) {
      return NextResponse.json({ parcels: [] });
    }

    conditions.push(inArray(landParcels.id, parcelIds));
  }

  const results = await db
    .select({
      id: landParcels.id,
      plotNumber: landParcels.plotNumber,
      areaValue: landParcels.areaValue,
      areaUnit: landParcels.areaUnit,
      status: landParcels.status,
      mouzaName: mouzas.name,
      jlNumber: mouzas.jlNumber,
      unionName: unions.name,
      upazilaName: upazilas.name,
      districtName: districts.name,
    })
    .from(landParcels)
    .innerJoin(mouzas, eq(landParcels.mouzaId, mouzas.id))
    .innerJoin(unions, eq(mouzas.unionId, unions.id))
    .innerJoin(upazilas, eq(unions.upazilaId, upazilas.id))
    .innerJoin(districts, eq(upazilas.districtId, districts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(50);

  return NextResponse.json({ parcels: results });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !canEditParcels(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createParcelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [parcel] = await db
    .insert(landParcels)
    .values({
      mouzaId: parsed.data.mouzaId,
      plotNumber: parsed.data.plotNumber,
      areaValue: parsed.data.areaValue,
      areaUnit: parsed.data.areaUnit,
      status: parsed.data.status ?? "active",
    })
    .returning();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entityTable: "land_parcels",
    entityId: parcel.id,
    newValue: parcel as unknown as Record<string, unknown>,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ parcel }, { status: 201 });
}
