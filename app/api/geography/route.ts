import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { divisions, districts, upazilas, unions, mouzas } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const level = searchParams.get("level") ?? "divisions";
  const parentId = searchParams.get("parentId");

  switch (level) {
    case "resolve": {
      const districtName = searchParams.get("district")?.trim();
      const upazilaName = searchParams.get("upazila")?.trim();
      const mouzaName = searchParams.get("mouza")?.trim();
      const jlNumber = searchParams.get("jlNumber")?.trim();
      const mCode = searchParams.get("mCode")?.trim();
      const ensure =
        searchParams.get("ensure") === "1" ||
        searchParams.get("ensure") === "true";
      if (!districtName && !upazilaName && !mouzaName) {
        return NextResponse.json(
          { error: "district, upazila, or mouza is required" },
          { status: 400 },
        );
      }

      const { resolveGeographyFromGisNames } = await import(
        "@/lib/geography/resolve-from-gis"
      );
      const resolved = await resolveGeographyFromGisNames({
        district: districtName,
        upazila: upazilaName,
        mouza: mouzaName,
        jlNumber,
        mCode,
        ensure,
      });

      return NextResponse.json(resolved);
    }
    case "divisions": {
      const data = await db.select().from(divisions).orderBy(asc(divisions.name));
      return NextResponse.json({ items: data });
    }
    case "districts": {
      if (!parentId) {
        return NextResponse.json({ error: "parentId required" }, { status: 400 });
      }
      const data = await db
        .select()
        .from(districts)
        .where(eq(districts.divisionId, parentId))
        .orderBy(asc(districts.name));
      return NextResponse.json({ items: data });
    }
    case "upazilas": {
      if (!parentId) {
        return NextResponse.json({ error: "parentId required" }, { status: 400 });
      }
      const data = await db
        .select()
        .from(upazilas)
        .where(eq(upazilas.districtId, parentId))
        .orderBy(asc(upazilas.name));
      return NextResponse.json({ items: data });
    }
    case "unions": {
      if (!parentId) {
        return NextResponse.json({ error: "parentId required" }, { status: 400 });
      }
      const data = await db
        .select()
        .from(unions)
        .where(eq(unions.upazilaId, parentId))
        .orderBy(asc(unions.name));
      return NextResponse.json({ items: data });
    }
    case "mouzas": {
      if (!parentId) {
        return NextResponse.json({ error: "parentId required" }, { status: 400 });
      }
      const byUnion = await db
        .select({
          id: mouzas.id,
          name: mouzas.name,
          jlNumber: mouzas.jlNumber,
          mCode: mouzas.mCode,
        })
        .from(mouzas)
        .where(eq(mouzas.unionId, parentId))
        .orderBy(asc(mouzas.name));

      if (byUnion.length > 0) {
        return NextResponse.json({ items: byUnion });
      }

      const byUpazila = await db
        .select({
          id: mouzas.id,
          name: mouzas.name,
          jlNumber: mouzas.jlNumber,
          mCode: mouzas.mCode,
        })
        .from(mouzas)
        .where(eq(mouzas.upazilaId, parentId))
        .orderBy(asc(mouzas.name));

      return NextResponse.json({ items: byUpazila });
    }
    case "plots": {
      if (!parentId) {
        return NextResponse.json({ error: "parentId required" }, { status: 400 });
      }
      const { listPlotsByMouzaFromGis, listPlotsByMouza } = await import(
        "@/lib/mouza-gis/queries"
      );
      const fromGis = await listPlotsByMouzaFromGis(parentId);
      if (fromGis.length > 0) {
        return NextResponse.json({
          items: fromGis.map((p) => ({
            id: p.parcelId ?? p.id,
            name: p.plotNo ?? "—",
            plotNumber: p.plotNo,
          })),
        });
      }
      const plots = await listPlotsByMouza(parentId);
      return NextResponse.json({
        items: plots.map((p) => ({
          id: p.id,
          name: p.plotNumber,
          plotNumber: p.plotNumber,
        })),
      });
    }
    default:
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
}
