import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { createDatasetSchema } from "@/lib/mouza-gis/validations";
import { listDatasets, findDhakaNorthDistrict } from "@/lib/mouza-gis/queries";
import { db } from "@/lib/db";
import { mouzaGisDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const datasets = await listDatasets();
  return NextResponse.json({ datasets });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createDatasetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let districtId = parsed.data.districtId;
  if (!districtId && parsed.data.slug.includes("dhaka-north")) {
    const dhaka = await findDhakaNorthDistrict();
    districtId = dhaka?.id;
  }

  const [existing] = await db
    .select({ id: mouzaGisDatasets.id })
    .from(mouzaGisDatasets)
    .where(eq(mouzaGisDatasets.slug, parsed.data.slug))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Dataset with this slug already exists" },
      { status: 409 },
    );
  }

  const [dataset] = await db
    .insert(mouzaGisDatasets)
    .values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      districtId,
      description: parsed.data.description,
    })
    .returning();

  return NextResponse.json({ dataset }, { status: 201 });
}
