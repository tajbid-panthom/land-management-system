import { NextRequest, NextResponse } from "next/server";
import {
  findDhakaNorthDistrict,
  listUpazilasForDhakaNorth,
  listMouzasForUpazilaName,
  listPlotsByMouzaFromGis,
  listPlotsByMouza,
  getMouzaGisDetail,
  getMouzaMapGeoJson,
} from "@/lib/mouza-gis/queries";
import { db } from "@/lib/db";
import { districts, upazilas } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const level = searchParams.get("level") ?? "districts";
  const districtId = searchParams.get("districtId");
  const upazilaId = searchParams.get("upazilaId");
  const upazilaName = searchParams.get("upazilaName");
  const mouzaId = searchParams.get("mouzaId");
  const plotNo = searchParams.get("plotNo");
  const mCode = searchParams.get("mCode");

  switch (level) {
    case "districts": {
      const dhaka = await findDhakaNorthDistrict();
      const items = dhaka
        ? [{ id: dhaka.id, name: dhaka.name }]
        : await db.select({ id: districts.id, name: districts.name }).from(districts).orderBy(asc(districts.name)).limit(20);
      return NextResponse.json({ items });
    }

    case "upazilas": {
      if (!districtId) {
        return NextResponse.json({ error: "districtId required" }, { status: 400 });
      }
      const fromGis = await listUpazilasForDhakaNorth(districtId);
      if (fromGis.length > 0) {
        return NextResponse.json({
          items: fromGis
            .filter((u) => u.name)
            .map((u) => ({ id: u.name!, name: u.name! })),
        });
      }
      const items = await db
        .select({ id: upazilas.id, name: upazilas.name })
        .from(upazilas)
        .where(eq(upazilas.districtId, districtId))
        .orderBy(asc(upazilas.name));
      return NextResponse.json({ items });
    }

    case "mouzas": {
      if (upazilaName && districtId) {
        const items = await listMouzasForUpazilaName(districtId, upazilaName);
        return NextResponse.json({
          items: items.map((m) => ({
            id: m.mouzaId ?? m.mCode,
            name: m.name,
            jlNumber: m.jlNumber,
            mCode: m.mCode,
          })),
        });
      }
      if (upazilaId) {
        const { listMouzasByUpazila } = await import("@/lib/mouza-gis/queries");
        const items = await listMouzasByUpazila(upazilaId);
        return NextResponse.json({ items });
      }
      return NextResponse.json({ error: "upazilaId or upazilaName required" }, { status: 400 });
    }

    case "plots": {
      if (!mouzaId) {
        return NextResponse.json({ error: "mouzaId required" }, { status: 400 });
      }
      const fromGis = await listPlotsByMouzaFromGis(mouzaId, mCode ?? undefined);
      if (fromGis.length > 0) {
        return NextResponse.json({
          items: fromGis.map((p) => ({
            id: p.parcelId ?? p.id,
            plotNumber: p.plotNo,
            areaValue: p.mAcres,
            landType: p.landType,
          })),
        });
      }
      const items = await listPlotsByMouza(mouzaId);
      return NextResponse.json({ items });
    }

    case "detail": {
      if (!mouzaId) {
        return NextResponse.json({ error: "mouzaId required" }, { status: 400 });
      }
      const detail = await getMouzaGisDetail(mouzaId, plotNo ?? undefined);
      if (!detail) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ detail });
    }

    case "geojson": {
      if (!mouzaId) {
        return NextResponse.json({ error: "mouzaId required" }, { status: 400 });
      }
      const geojson = await getMouzaMapGeoJson(mouzaId, plotNo ?? undefined);
      return NextResponse.json(geojson);
    }

    default:
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
}
