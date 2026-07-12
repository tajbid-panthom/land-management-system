import { and, count, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  properties,
  propertyLocations,
  propertyDocuments,
  documentCategories,
  districts,
  upazilas,
  mouzas,
  divisions,
  mouzaGisRecords,
  mouzaGisDatasets,
  landParcels,
  khatians,
} from "@/lib/db/schema";
import { getMouzaGisDetail } from "@/lib/mouza-gis/queries";
import { getPropertyDetail } from "@/lib/properties/queries";
import { findGisLayerFeatureForLocation } from "@/lib/gis-maps/resolve-property";

export type PropertyDocumentAvailability = {
  registrationDeed: boolean;
  mutationCertificate: boolean;
  khatianCopy: boolean;
  surveyMap: boolean;
  registrationDeedId: string | null;
  mutationCertificateId: string | null;
  khatianCopyId: string | null;
  surveyMapId: string | null;
};

export type PropertyGisSnapshot = {
  propertyId: string;
  propertyCode: string;
  parcelId: string;
  status: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  union: string | null;
  mouza: string | null;
  mouzaId: string | null;
  jlNumber: string | null;
  plotNumber: string | null;
  khatianNumbers: string | null;
  landClass: string | null;
  landType: string | null;
  area: string | null;
  areaUnit: string | null;
  revenueNumber: string | null;
  sheetNumber: string | null;
  coordinates: string | null;
  geometryType: string | null;
  syncStatus: string | null;
  syncMessage: string | null;
  hasGeometry: boolean;
  gisRecordId: string | null;
  featureId: string | null;
  documents: PropertyDocumentAvailability;
  mapHref: string | null;
};

export function buildMapViewerHref(input: {
  mouzaId?: string | null;
  plotNumber?: string | null;
  datasetId?: string | null;
  mapId?: string | null;
  featureId?: string | null;
  mauza?: string | null;
}): string | null {
  if (
    !input.mouzaId &&
    !input.plotNumber &&
    !input.mapId &&
    !input.featureId
  ) {
    return null;
  }
  const params = new URLSearchParams();
  if (input.mapId) params.set("mapId", input.mapId);
  if (input.mouzaId) params.set("mouzaId", input.mouzaId);
  if (input.plotNumber) params.set("plotNo", input.plotNumber);
  if (input.datasetId) params.set("datasetId", input.datasetId);
  if (input.featureId) params.set("featureId", input.featureId);
  if (input.mauza) params.set("mauza", input.mauza);
  return `/dashboard/maps/viewer?${params.toString()}`;
}

async function getDocumentAvailability(
  propertyId: string,
): Promise<PropertyDocumentAvailability> {
  const docs = await db
    .select({
      id: propertyDocuments.id,
      slug: documentCategories.slug,
    })
    .from(propertyDocuments)
    .innerJoin(
      documentCategories,
      eq(propertyDocuments.categoryId, documentCategories.id),
    )
    .where(
      and(
        eq(propertyDocuments.propertyId, propertyId),
        isNull(propertyDocuments.deletedAt),
      ),
    );

  const find = (slug: string) => docs.find((d) => d.slug === slug)?.id ?? null;

  return {
    registrationDeed: Boolean(find("deed_copy")),
    mutationCertificate: Boolean(find("mutation_certificate")),
    khatianCopy: Boolean(find("khatian_copy")),
    surveyMap: Boolean(find("survey_map")),
    registrationDeedId: find("deed_copy"),
    mutationCertificateId: find("mutation_certificate"),
    khatianCopyId: find("khatian_copy"),
    surveyMapId: find("survey_map"),
  };
}

/**
 * Canonical GIS-synchronized property snapshot used across the Admin Panel.
 * Prefers mouza GIS record attributes; falls back to property_locations.
 */
export async function getPropertyGisSnapshot(
  propertyId: string,
): Promise<PropertyGisSnapshot | null> {
  const detail = await getPropertyDetail(propertyId);
  if (!detail) return null;

  const { property } = detail;
  const gis =
    property.mouzaId && property.plotNumber
      ? await getMouzaGisDetail(property.mouzaId, property.plotNumber)
      : null;

  const layerFeature =
    !gis?.geometry
      ? await findGisLayerFeatureForLocation({
          plotNumber: property.plotNumber,
          mouzaName: property.mouzaName,
          districtName: property.districtName,
          upazilaName: property.upazilaName,
        })
      : null;

  const documents = await getDocumentAvailability(propertyId);

  const khatianFromProperty = [
    property.khatianCs ? `CS: ${property.khatianCs}` : null,
    property.khatianSa ? `SA: ${property.khatianSa}` : null,
    property.khatianRs ? `RS: ${property.khatianRs}` : null,
    property.khatianBs ? `BS: ${property.khatianBs}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const hasGeometry = Boolean(gis?.geometry) || Boolean(layerFeature?.hasGeometry);
  const syncStatus = gis?.syncStatus
    ?? (layerFeature ? "linked" : gis ? "synced" : "unlinked");

  return {
    propertyId: property.id,
    propertyCode: property.propertyCode,
    parcelId: property.parcelId,
    status: property.status,
    division: property.divisionName ?? null,
    district: gis?.mDistrict ?? property.districtName ?? null,
    upazila: gis?.mUpazila ?? property.upazilaName ?? null,
    union: gis?.unionName ?? property.unionName ?? null,
    mouza: gis?.mauza ?? property.mouzaName ?? null,
    mouzaId: property.mouzaId,
    jlNumber: gis?.jlNo ?? property.jlNumber ?? null,
    plotNumber: gis?.plotNo ?? property.plotNumber ?? null,
    khatianNumbers: gis?.khatianNumbers ?? (khatianFromProperty || null),
    landClass: gis?.landClass ?? null,
    landType: gis?.landType ?? null,
    area:
      gis?.mAcres ??
      property.areaAcre ??
      property.areaDecimal ??
      null,
    areaUnit: gis?.mAcres ? "acres" : property.areaAcre ? "acres" : "decimal",
    revenueNumber: gis?.revenueNo ?? null,
    sheetNumber: gis?.sheetNo ?? null,
    coordinates: gis?.coordinates ?? layerFeature?.coordinates ?? null,
    geometryType: gis?.geometry?.type ?? layerFeature?.geometryType ?? null,
    syncStatus,
    syncMessage:
      gis?.syncMessage ??
      (layerFeature
        ? `Matched GIS layer ${layerFeature.layerName}`
        : null),
    hasGeometry,
    gisRecordId: gis?.id ?? null,
    featureId: gis?.featureId ?? layerFeature?.featureId ?? null,
    documents,
    mapHref: buildMapViewerHref({
      mouzaId: property.mouzaId,
      plotNumber: property.plotNumber,
      mapId: layerFeature?.mapId,
      featureId: layerFeature?.featureId,
      mauza: property.mouzaName,
    }),
  };
}

export type PropertyListGisEnrichment = {
  syncStatus: string;
  hasGeometry: boolean;
  hasRegistrationDeed: boolean;
  hasMutationCertificate: boolean;
  mapHref: string | null;
};

/** Batch-enrich property list rows with GIS sync + document flags (efficient joins). */
export async function enrichPropertiesWithGis(
  items: Array<{
    id: string;
    parcelId: string;
    mouzaId: string | null;
    plotNumber: string | null;
  }>,
): Promise<Map<string, PropertyListGisEnrichment>> {
  const result = new Map<string, PropertyListGisEnrichment>();
  if (items.length === 0) return result;

  const propertyIds = items.map((i) => i.id);
  const parcelIds = items.map((i) => i.parcelId).filter(Boolean);

  const [gisRows, docRows] = await Promise.all([
    parcelIds.length
      ? db
          .select({
            parcelId: mouzaGisRecords.parcelId,
            syncStatus: mouzaGisRecords.syncStatus,
            featureId: mouzaGisRecords.featureId,
          })
          .from(mouzaGisRecords)
          .where(
            sql`${mouzaGisRecords.parcelId} IN (${sql.join(
              parcelIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`,
          )
      : Promise.resolve([]),
    db
      .select({
        propertyId: propertyDocuments.propertyId,
        slug: documentCategories.slug,
      })
      .from(propertyDocuments)
      .innerJoin(
        documentCategories,
        eq(propertyDocuments.categoryId, documentCategories.id),
      )
      .where(
        and(
          sql`${propertyDocuments.propertyId} IN (${sql.join(
            propertyIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
          isNull(propertyDocuments.deletedAt),
          sql`${documentCategories.slug} IN ('deed_copy', 'mutation_certificate')`,
        ),
      ),
  ]);

  const gisByParcel = new Map(
    gisRows
      .filter((r) => r.parcelId)
      .map((r) => [r.parcelId as string, r]),
  );

  const docsByProperty = new Map<string, Set<string>>();
  for (const doc of docRows) {
    const set = docsByProperty.get(doc.propertyId) ?? new Set();
    if (doc.slug) set.add(doc.slug);
    docsByProperty.set(doc.propertyId, set);
  }

  for (const item of items) {
    const gis = item.parcelId ? gisByParcel.get(item.parcelId) : undefined;
    const docs = docsByProperty.get(item.id) ?? new Set();
    result.set(item.id, {
      syncStatus: gis?.syncStatus ?? "unlinked",
      hasGeometry: Boolean(gis?.featureId),
      hasRegistrationDeed: docs.has("deed_copy"),
      hasMutationCertificate: docs.has("mutation_certificate"),
      mapHref: buildMapViewerHref({
        mouzaId: item.mouzaId,
        plotNumber: item.plotNumber,
      }),
    });
  }

  return result;
}

export type AdminPlotRow = {
  id: string;
  plotNumber: string | null;
  mouzaName: string | null;
  mouzaId: string | null;
  jlNumber: string | null;
  district: string | null;
  upazila: string | null;
  area: string | null;
  landType: string | null;
  landClass: string | null;
  syncStatus: string | null;
  hasGeometry: boolean;
  propertyId: string | null;
  propertyCode: string | null;
  mapHref: string | null;
};

/** List GIS plots (mouza_gis_records) with optional property linkage. */
export async function listAdminGisPlots(options?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ items: AdminPlotRow[]; total: number; page: number; limit: number }> {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 50, 200);
  const offset = (page - 1) * limit;
  const search = options?.search?.trim();

  const searchFilter = search
    ? sql`AND (
        r.plot_no ILIKE ${`%${search}%`}
        OR r.mauza ILIKE ${`%${search}%`}
        OR r.jl_no ILIKE ${`%${search}%`}
        OR r.m_district ILIKE ${`%${search}%`}
        OR r.m_upazila ILIKE ${`%${search}%`}
        OR p.property_code ILIKE ${`%${search}%`}
      )`
    : sql``;

  const totalResult = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM mouza_gis_records r
    LEFT JOIN properties p
      ON p.parcel_id = r.parcel_id AND p.deleted_at IS NULL
    WHERE r.plot_no IS NOT NULL
      ${searchFilter}
  `);
  const total = totalResult.rows[0]?.count ?? 0;

  const rows = await db.execute<{
    id: string;
    plot_no: string | null;
    mauza: string | null;
    mouza_id: string | null;
    jl_no: string | null;
    m_district: string | null;
    m_upazila: string | null;
    m_acres: string | null;
    land_type: string | null;
    land_class: string | null;
    sync_status: string | null;
    feature_id: string | null;
    property_id: string | null;
    property_code: string | null;
  }>(sql`
    SELECT
      r.id,
      r.plot_no,
      r.mauza,
      r.mouza_id,
      r.jl_no,
      r.m_district,
      r.m_upazila,
      r.m_acres::text,
      r.land_type,
      r.land_class,
      r.sync_status,
      r.feature_id,
      p.id AS property_id,
      p.property_code
    FROM mouza_gis_records r
    LEFT JOIN properties p
      ON p.parcel_id = r.parcel_id AND p.deleted_at IS NULL
    WHERE r.plot_no IS NOT NULL
      ${searchFilter}
    ORDER BY r.mauza ASC NULLS LAST, r.plot_no ASC NULLS LAST
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const items: AdminPlotRow[] = (rows.rows ?? []).map((row) => ({
    id: row.id,
    plotNumber: row.plot_no,
    mouzaName: row.mauza,
    mouzaId: row.mouza_id,
    jlNumber: row.jl_no,
    district: row.m_district,
    upazila: row.m_upazila,
    area: row.m_acres,
    landType: row.land_type,
    landClass: row.land_class,
    syncStatus: row.sync_status,
    hasGeometry: Boolean(row.feature_id),
    propertyId: row.property_id,
    propertyCode: row.property_code,
    mapHref: buildMapViewerHref({
      mouzaId: row.mouza_id,
      plotNumber: row.plot_no,
    }),
  }));

  return { items, total, page, limit };
}

export type AdminKhatianRow = {
  id: string;
  source: "legacy" | "property";
  khatianType: string;
  khatianNumber: string;
  plotNumber: string | null;
  mouzaName: string | null;
  mouzaId: string | null;
  propertyId: string | null;
  propertyCode: string | null;
  mapHref: string | null;
};

/**
 * Combined khatian list from legacy khatians table and property_locations
 * CS/SA/RS/BS fields (GIS-synchronized property records).
 */
export async function listAdminKhatians(options?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ items: AdminKhatianRow[]; total: number; page: number; limit: number }> {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 100, 200);
  const offset = (page - 1) * limit;
  const search = options?.search?.trim();
  const pattern = search ? `%${search}%` : null;

  const legacy = await db
    .select({
      id: khatians.id,
      khatianType: khatians.khatianType,
      khatianNumber: khatians.khatianNumber,
      plotNumber: landParcels.plotNumber,
      mouzaId: landParcels.mouzaId,
      mouzaName: mouzas.name,
      propertyId: properties.id,
      propertyCode: properties.propertyCode,
    })
    .from(khatians)
    .innerJoin(landParcels, eq(khatians.parcelId, landParcels.id))
    .leftJoin(mouzas, eq(landParcels.mouzaId, mouzas.id))
    .leftJoin(
      properties,
      and(eq(properties.parcelId, landParcels.id), isNull(properties.deletedAt)),
    )
    .where(
      pattern
        ? or(
            ilike(khatians.khatianNumber, pattern),
            ilike(landParcels.plotNumber, pattern),
            ilike(mouzas.name, pattern),
            ilike(properties.propertyCode, pattern),
          )
        : undefined,
    )
    .limit(500);

  const fromLocations = await db
    .select({
      propertyId: properties.id,
      propertyCode: properties.propertyCode,
      plotNumber: propertyLocations.plotNumber,
      mouzaId: propertyLocations.mouzaId,
      mouzaName: propertyLocations.mouzaName,
      khatianCs: propertyLocations.khatianCs,
      khatianSa: propertyLocations.khatianSa,
      khatianRs: propertyLocations.khatianRs,
      khatianBs: propertyLocations.khatianBs,
    })
    .from(properties)
    .innerJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .where(
      and(
        isNull(properties.deletedAt),
        or(
          isNotNull(propertyLocations.khatianCs),
          isNotNull(propertyLocations.khatianSa),
          isNotNull(propertyLocations.khatianRs),
          isNotNull(propertyLocations.khatianBs),
        ),
        pattern
          ? or(
              ilike(propertyLocations.plotNumber, pattern),
              ilike(propertyLocations.mouzaName, pattern),
              ilike(properties.propertyCode, pattern),
              ilike(propertyLocations.khatianCs, pattern),
              ilike(propertyLocations.khatianSa, pattern),
              ilike(propertyLocations.khatianRs, pattern),
              ilike(propertyLocations.khatianBs, pattern),
            )
          : undefined,
      ),
    )
    .limit(500);

  const items: AdminKhatianRow[] = [];

  for (const row of legacy) {
    items.push({
      id: `legacy:${row.id}`,
      source: "legacy",
      khatianType: row.khatianType,
      khatianNumber: row.khatianNumber,
      plotNumber: row.plotNumber,
      mouzaName: row.mouzaName,
      mouzaId: row.mouzaId,
      propertyId: row.propertyId,
      propertyCode: row.propertyCode,
      mapHref: buildMapViewerHref({
        mouzaId: row.mouzaId,
        plotNumber: row.plotNumber,
      }),
    });
  }

  for (const row of fromLocations) {
    const pairs: Array<[string, string | null]> = [
      ["CS", row.khatianCs],
      ["SA", row.khatianSa],
      ["RS", row.khatianRs],
      ["BS", row.khatianBs],
    ];
    for (const [type, number] of pairs) {
      if (!number?.trim()) continue;
      items.push({
        id: `property:${row.propertyId}:${type}`,
        source: "property",
        khatianType: type,
        khatianNumber: number,
        plotNumber: row.plotNumber,
        mouzaName: row.mouzaName,
        mouzaId: row.mouzaId,
        propertyId: row.propertyId,
        propertyCode: row.propertyCode,
        mapHref: buildMapViewerHref({
          mouzaId: row.mouzaId,
          plotNumber: row.plotNumber,
        }),
      });
    }
  }

  items.sort((a, b) => {
    const mouzaCmp = (a.mouzaName ?? "").localeCompare(b.mouzaName ?? "");
    if (mouzaCmp !== 0) return mouzaCmp;
    return (a.plotNumber ?? "").localeCompare(b.plotNumber ?? "", undefined, {
      numeric: true,
    });
  });

  const total = items.length;
  const pageItems = items.slice(offset, offset + limit);
  return { items: pageItems, total, page, limit };
}

export type AdminGisDashboardStats = {
  totalProperties: number;
  totalDistricts: number;
  totalUpazilas: number;
  totalMouzas: number;
  totalPlots: number;
  propertiesWithGis: number;
  propertiesWithoutGis: number;
  propertiesWithRegistrationDeed: number;
  propertiesWithMutationCertificate: number;
  gisSyncedRecords: number;
  gisGeometryMissing: number;
  gisImportDatasets: number;
};

export async function getAdminGisDashboardStats(): Promise<AdminGisDashboardStats> {
  const [
    [propCount],
    [districtCount],
    [upazilaCount],
    [mouzaCount],
    [plotCount],
    [withGis],
    [withDeed],
    [withMutation],
    [synced],
    [geomMissing],
    [datasets],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(properties)
      .where(isNull(properties.deletedAt)),
    db.select({ count: count() }).from(districts),
    db.select({ count: count() }).from(upazilas),
    db.select({ count: count() }).from(mouzas),
    db
      .select({ count: count() })
      .from(propertyLocations)
      .innerJoin(properties, eq(propertyLocations.propertyId, properties.id))
      .where(isNull(properties.deletedAt)),
    db
      .select({ count: count() })
      .from(properties)
      .innerJoin(landParcels, eq(properties.parcelId, landParcels.id))
      .innerJoin(mouzaGisRecords, eq(mouzaGisRecords.parcelId, landParcels.id))
      .where(isNull(properties.deletedAt)),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${propertyDocuments.propertyId})::int` })
      .from(propertyDocuments)
      .innerJoin(
        documentCategories,
        eq(propertyDocuments.categoryId, documentCategories.id),
      )
      .where(
        and(
          isNull(propertyDocuments.deletedAt),
          eq(documentCategories.slug, "deed_copy"),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${propertyDocuments.propertyId})::int` })
      .from(propertyDocuments)
      .innerJoin(
        documentCategories,
        eq(propertyDocuments.categoryId, documentCategories.id),
      )
      .where(
        and(
          isNull(propertyDocuments.deletedAt),
          eq(documentCategories.slug, "mutation_certificate"),
        ),
      ),
    db
      .select({ count: count() })
      .from(mouzaGisRecords)
      .where(eq(mouzaGisRecords.syncStatus, "synced")),
    db
      .select({ count: count() })
      .from(mouzaGisRecords)
      .where(eq(mouzaGisRecords.syncStatus, "geometry_missing")),
    db.select({ count: count() }).from(mouzaGisDatasets),
  ]);

  const totalProperties = propCount?.count ?? 0;
  const propertiesWithGis = withGis?.count ?? 0;

  return {
    totalProperties,
    totalDistricts: districtCount?.count ?? 0,
    totalUpazilas: upazilaCount?.count ?? 0,
    totalMouzas: mouzaCount?.count ?? 0,
    totalPlots: plotCount?.count ?? 0,
    propertiesWithGis,
    propertiesWithoutGis: Math.max(0, totalProperties - propertiesWithGis),
    propertiesWithRegistrationDeed: Number(withDeed?.count ?? 0),
    propertiesWithMutationCertificate: Number(withMutation?.count ?? 0),
    gisSyncedRecords: synced?.count ?? 0,
    gisGeometryMissing: geomMissing?.count ?? 0,
    gisImportDatasets: datasets?.count ?? 0,
  };
}

export type GisAnalyticsBreakdown = {
  byDistrict: Array<{ name: string; count: number }>;
  byUpazila: Array<{ name: string; count: number }>;
  byMouza: Array<{ name: string; count: number }>;
  byLandType: Array<{ name: string; count: number }>;
  byLandClass: Array<{ name: string; count: number }>;
  byPropertyStatus: Array<{ name: string; count: number }>;
  bySyncStatus: Array<{ name: string; count: number }>;
  byDivision: Array<{ name: string; count: number }>;
};

export async function getGisAnalyticsBreakdown(): Promise<GisAnalyticsBreakdown> {
  const [
    byDistrict,
    byUpazila,
    byMouza,
    byLandType,
    byLandClass,
    byPropertyStatus,
    bySyncStatus,
    byDivision,
  ] = await Promise.all([
    db
      .select({
        name: sql<string>`COALESCE(${propertyLocations.districtId}::text, 'Unknown')`,
        label: districts.name,
        count: count(),
      })
      .from(properties)
      .innerJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
      .leftJoin(districts, eq(propertyLocations.districtId, districts.id))
      .where(isNull(properties.deletedAt))
      .groupBy(propertyLocations.districtId, districts.name)
      .orderBy(sql`count(*) DESC`)
      .limit(20)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "Unknown", count: r.count })),
      ),
    db
      .select({
        label: upazilas.name,
        count: count(),
      })
      .from(properties)
      .innerJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
      .leftJoin(upazilas, eq(propertyLocations.upazilaId, upazilas.id))
      .where(isNull(properties.deletedAt))
      .groupBy(propertyLocations.upazilaId, upazilas.name)
      .orderBy(sql`count(*) DESC`)
      .limit(20)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "Unknown", count: r.count })),
      ),
    db
      .select({
        label: propertyLocations.mouzaName,
        count: count(),
      })
      .from(properties)
      .innerJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
      .where(isNull(properties.deletedAt))
      .groupBy(propertyLocations.mouzaName)
      .orderBy(sql`count(*) DESC`)
      .limit(20)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "Unknown", count: r.count })),
      ),
    db
      .select({
        label: mouzaGisRecords.landType,
        count: count(),
      })
      .from(mouzaGisRecords)
      .groupBy(mouzaGisRecords.landType)
      .orderBy(sql`count(*) DESC`)
      .limit(15)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "Unknown", count: r.count })),
      ),
    db
      .select({
        label: mouzaGisRecords.landClass,
        count: count(),
      })
      .from(mouzaGisRecords)
      .groupBy(mouzaGisRecords.landClass)
      .orderBy(sql`count(*) DESC`)
      .limit(15)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "Unknown", count: r.count })),
      ),
    db
      .select({
        label: properties.status,
        count: count(),
      })
      .from(properties)
      .where(isNull(properties.deletedAt))
      .groupBy(properties.status)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "unknown", count: r.count })),
      ),
    db
      .select({
        label: mouzaGisRecords.syncStatus,
        count: count(),
      })
      .from(mouzaGisRecords)
      .groupBy(mouzaGisRecords.syncStatus)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "unknown", count: r.count })),
      ),
    db
      .select({
        label: divisions.name,
        count: count(),
      })
      .from(properties)
      .innerJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
      .leftJoin(divisions, eq(propertyLocations.divisionId, divisions.id))
      .where(isNull(properties.deletedAt))
      .groupBy(propertyLocations.divisionId, divisions.name)
      .orderBy(sql`count(*) DESC`)
      .limit(20)
      .then((rows) =>
        rows.map((r) => ({ name: r.label ?? "Unknown", count: r.count })),
      ),
  ]);

  return {
    byDistrict,
    byUpazila,
    byMouza,
    byLandType,
    byLandClass,
    byPropertyStatus,
    bySyncStatus,
    byDivision,
  };
}
