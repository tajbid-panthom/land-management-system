import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const [property] = await db
    .select({
      id: properties.id,
      propertyCode: properties.propertyCode,
      parcelId: properties.parcelId,
      status: properties.status,
    })
    .from(properties)
    .where(
      and(eq(properties.propertyCode, code), isNull(properties.deletedAt)),
    )
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({ property });
}
