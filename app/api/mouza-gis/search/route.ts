import { NextRequest, NextResponse } from "next/server";
import {
  listUpazilasForDataset,
  listMouzasForUpazilaName,
  listPlotsByMouzaFromGis,
  listPlotsByMouza,
  getMouzaGisDetail,
  getMouzaMapGeoJson,
  searchMouzaRecords,
  getSynchronizedDatasetGeoJson,
  getMouzaRecordById,
  getDatasetById,
} from "@/lib/mouza-gis/queries";
import { db } from "@/lib/db";
import { districts, upazilas } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const level = searchParams.get("level") ?? "districts";
  const datasetId = searchParams.get("datasetId");
  const districtId = searchParams.get("districtId");
  const upazilaId = searchParams.get("upazilaId");
  const upazilaName = searchParams.get("upazilaName");
  const mouzaId = searchParams.get("mouzaId");
  const plotNo = searchParams.get("plotNo");
  const mCode = searchParams.get("mCode");

  switch (level) {
    case "districts": {
      if (datasetId) {
        const dataset = await getDatasetById(datasetId);
        if (dataset?.districtId) {
          const [district] = await db
            .select({ id: districts.id, name: districts.name })
            .from(districts)
            .where(eq(districts.id, dataset.districtId))
            .limit(1);
          if (district) {
            return NextResponse.json({ items: [district] });
          }
        }
      }
      const items = await db
        .select({ id: districts.id, name: districts.name })
        .from(districts)
        .orderBy(asc(districts.name))
        .limit(50);
      return NextResponse.json({ items });
    }

    case "upazilas": {
      if (datasetId) {
        const fromGis = await listUpazilasForDataset(datasetId);
        if (fromGis.length > 0) {
          return NextResponse.json({
            items: fromGis
              .filter((u) => u.name)
              .map((u) => ({ id: u.name!, name: u.name! })),
          });
        }
      }
      if (!districtId) {
        return NextResponse.json({ error: "datasetId or districtId required" }, { status: 400 });
      }
      const items = await db
        .select({ id: upazilas.id, name: upazilas.name })
        .from(upazilas)
        .where(eq(upazilas.districtId, districtId))
        .orderBy(asc(upazilas.name));
      return NextResponse.json({ items });
    }

    case "mouzas": {
      if (datasetId && upazilaName) {
        const items = await listMouzasForUpazilaName(datasetId, upazilaName);
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
      return NextResponse.json({ error: "datasetId+upazilaName or upazilaId required" }, { status: 400 });
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

    case "search": {
      const q = searchParams.get("q");
      if (!q?.trim()) {
        return NextResponse.json({ error: "q is required" }, { status: 400 });
      }
      const datasetId = searchParams.get("datasetId") ?? undefined;
      const results = await searchMouzaRecords(q, {
        datasetId,
        district: searchParams.get("district") ?? undefined,
        upazila: searchParams.get("upazila") ?? undefined,
        mouza: searchParams.get("mouza") ?? undefined,
        jlNo: searchParams.get("jlNo") ?? undefined,
        mCode: searchParams.get("mCode") ?? undefined,
        plotNo: searchParams.get("plotNo") ?? undefined,
      });
      return NextResponse.json({ results });
    }

    case "synced-geojson": {
      const datasetId = searchParams.get("datasetId");
      if (!datasetId) {
        return NextResponse.json({ error: "datasetId required" }, { status: 400 });
      }
      const dataset = await getDatasetById(datasetId);
      if (!dataset) {
        return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
      }
      const { parseBBoxParam } = await import("@/lib/gis-maps/viewport");
      const bbox = parseBBoxParam(searchParams.get("bbox"));
      const zoomRaw = searchParams.get("zoom");
      const zoom = zoomRaw != null ? Number(zoomRaw) : undefined;
      const limitRaw = searchParams.get("limit");
      const limit = limitRaw != null ? Number(limitRaw) : undefined;
      const geojson = await getSynchronizedDatasetGeoJson(datasetId, {
        bbox: bbox ?? undefined,
        zoom: Number.isFinite(zoom) ? zoom : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      return NextResponse.json(geojson);
    }

    case "record": {
      const recordId = searchParams.get("recordId");
      if (!recordId) {
        return NextResponse.json({ error: "recordId required" }, { status: 400 });
      }
      const record = await getMouzaRecordById(recordId);
      if (!record) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const detail = record.mouzaId
        ? await getMouzaGisDetail(record.mouzaId, record.plotNo ?? undefined)
        : null;
      return NextResponse.json({ record, detail });
    }

    default:
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
}
