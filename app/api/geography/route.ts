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
      if (!districtName && !upazilaName && !mouzaName) {
        return NextResponse.json(
          { error: "district, upazila, or mouza is required" },
          { status: 400 },
        );
      }

      const { ilike, and } = await import("drizzle-orm");

      let divisionId: string | null = null;
      let divisionName: string | null = null;
      let districtId: string | null = null;
      let resolvedDistrictName: string | null = null;
      let upazilaId: string | null = null;
      let resolvedUpazilaName: string | null = null;
      let unionId: string | null = null;
      let mouzaId: string | null = null;
      let resolvedMouzaName: string | null = null;
      let jlNumber: string | null = null;

      if (districtName) {
        const [district] = await db
          .select({
            id: districts.id,
            name: districts.name,
            divisionId: districts.divisionId,
            divisionName: divisions.name,
          })
          .from(districts)
          .innerJoin(divisions, eq(districts.divisionId, divisions.id))
          .where(ilike(districts.name, districtName))
          .limit(1);
        if (district) {
          districtId = district.id;
          resolvedDistrictName = district.name;
          divisionId = district.divisionId;
          divisionName = district.divisionName;
        }
      }

      if (upazilaName) {
        const upazilaConditions = [ilike(upazilas.name, upazilaName)];
        if (districtId) {
          upazilaConditions.push(eq(upazilas.districtId, districtId));
        }
        const [upazila] = await db
          .select({
            id: upazilas.id,
            name: upazilas.name,
            districtId: upazilas.districtId,
          })
          .from(upazilas)
          .where(and(...upazilaConditions))
          .limit(1);
        if (upazila) {
          upazilaId = upazila.id;
          resolvedUpazilaName = upazila.name;
          if (!districtId) {
            districtId = upazila.districtId;
            const [district] = await db
              .select({
                id: districts.id,
                name: districts.name,
                divisionId: districts.divisionId,
                divisionName: divisions.name,
              })
              .from(districts)
              .innerJoin(divisions, eq(districts.divisionId, divisions.id))
              .where(eq(districts.id, upazila.districtId))
              .limit(1);
            if (district) {
              resolvedDistrictName = district.name;
              divisionId = district.divisionId;
              divisionName = district.divisionName;
            }
          }
        }
      }

      if (mouzaName) {
        const mouzaConditions = [ilike(mouzas.name, mouzaName)];
        if (upazilaId) {
          mouzaConditions.push(eq(mouzas.upazilaId, upazilaId));
        }
        const [mouza] = await db
          .select({
            id: mouzas.id,
            name: mouzas.name,
            jlNumber: mouzas.jlNumber,
            upazilaId: mouzas.upazilaId,
            unionId: mouzas.unionId,
          })
          .from(mouzas)
          .where(and(...mouzaConditions))
          .limit(1);
        if (mouza) {
          mouzaId = mouza.id;
          resolvedMouzaName = mouza.name;
          jlNumber = mouza.jlNumber;
          unionId = mouza.unionId;
          if (!upazilaId && mouza.upazilaId) {
            upazilaId = mouza.upazilaId;
            const [upazila] = await db
              .select({
                id: upazilas.id,
                name: upazilas.name,
                districtId: upazilas.districtId,
              })
              .from(upazilas)
              .where(eq(upazilas.id, mouza.upazilaId))
              .limit(1);
            if (upazila) {
              resolvedUpazilaName = upazila.name;
              if (!districtId) {
                districtId = upazila.districtId;
                const [district] = await db
                  .select({
                    id: districts.id,
                    name: districts.name,
                    divisionId: districts.divisionId,
                    divisionName: divisions.name,
                  })
                  .from(districts)
                  .innerJoin(divisions, eq(districts.divisionId, divisions.id))
                  .where(eq(districts.id, upazila.districtId))
                  .limit(1);
                if (district) {
                  resolvedDistrictName = district.name;
                  divisionId = district.divisionId;
                  divisionName = district.divisionName;
                }
              }
            }
          }
        }
      }

      return NextResponse.json({
        divisionId,
        divisionName,
        districtId,
        districtName: resolvedDistrictName,
        upazilaId,
        upazilaName: resolvedUpazilaName,
        unionId,
        mouzaId,
        mouzaName: resolvedMouzaName,
        jlNumber,
      });
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
