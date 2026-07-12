import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courtCases,
  deeds,
  districts,
  documentCategories,
  khatians,
  mouzaGisRecords,
  mouzas,
  mutationCases,
  owners,
  ownershipRecords,
  properties,
  propertyDeeds,
  propertyDocuments,
  propertyLocations,
  upazilas,
} from "@/lib/db/schema";
import type { MouzaPopupDetail } from "@/lib/gis-maps/feature-popup";
import { formatCoordinates } from "@/lib/gis-maps/feature-popup";
import {
  extractGisMatchKeys,
  normalizePlotNo,
  type GisMatchKeys,
} from "@/lib/gis-maps/gis-attributes";
import { getMouzaGisDetail } from "@/lib/mouza-gis/queries";

export type { GisMatchKeys } from "@/lib/gis-maps/gis-attributes";
export { extractGisMatchKeys, normalizePlotNo } from "@/lib/gis-maps/gis-attributes";

type MatchedProperty = {
  id: string;
  propertyCode: string;
  parcelId: string;
  mouzaId: string | null;
  plotNumber: string | null;
  mouzaName: string | null;
  jlNumber: string | null;
  districtName: string | null;
  upazilaName: string | null;
  areaAcre: string | null;
  score: number;
};

async function findMatchingProperties(
  keys: GisMatchKeys,
): Promise<MatchedProperty[]> {
  const plotNo = keys.plotNo;
  if (!plotNo) return [];

  const conditions = [
    isNull(properties.deletedAt),
    isNull(propertyLocations.deletedAt),
    sql`TRIM(BOTH FROM ${propertyLocations.plotNumber}) = ${plotNo}`,
  ];

  if (keys.mauza) {
    conditions.push(
      or(
        ilike(propertyLocations.mouzaName, keys.mauza),
        ilike(mouzas.name, keys.mauza),
      )!,
    );
  } else if (keys.district || keys.upazila) {
    const locationParts = [];
    if (keys.district) {
      locationParts.push(ilike(districts.name, keys.district));
    }
    if (keys.upazila) {
      locationParts.push(ilike(upazilas.name, keys.upazila));
    }
    conditions.push(and(...locationParts)!);
  } else {
    return [];
  }

  const rows = await db
    .select({
      id: properties.id,
      propertyCode: properties.propertyCode,
      parcelId: properties.parcelId,
      mouzaId: propertyLocations.mouzaId,
      plotNumber: propertyLocations.plotNumber,
      mouzaName: propertyLocations.mouzaName,
      jlNumber: propertyLocations.jlNumber,
      districtName: districts.name,
      upazilaName: upazilas.name,
      areaAcre: propertyLocations.areaAcre,
    })
    .from(properties)
    .innerJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .leftJoin(districts, eq(propertyLocations.districtId, districts.id))
    .leftJoin(upazilas, eq(propertyLocations.upazilaId, upazilas.id))
    .leftJoin(mouzas, eq(propertyLocations.mouzaId, mouzas.id))
    .where(and(...conditions))
    .limit(20);

  return rows
    .map((row) => {
      let score = 1;
      if (
        keys.mauza &&
        (row.mouzaName?.toLowerCase() === keys.mauza.toLowerCase() ||
          row.mouzaName?.toLowerCase().includes(keys.mauza.toLowerCase()))
      ) {
        score += 3;
      }
      if (
        keys.district &&
        row.districtName?.toLowerCase() === keys.district.toLowerCase()
      ) {
        score += 2;
      }
      if (
        keys.upazila &&
        row.upazilaName?.toLowerCase() === keys.upazila.toLowerCase()
      ) {
        score += 2;
      }
      if (keys.jlNo && row.jlNumber) {
        const propJl = row.jlNumber.replace(/^JL-?/i, "").trim();
        const gisJl = keys.jlNo.replace(/^JL-?/i, "").trim();
        if (propJl === gisJl || row.jlNumber === keys.jlNo) score += 1;
      }
      return { ...row, score };
    })
    .sort((a, b) => b.score - a.score);
}

async function loadPropertyPopupFields(property: MatchedProperty): Promise<{
  khatianNumbers: string | null;
  currentOwners: string | null;
  ownershipStatus: string | null;
  ownerCount: number | null;
  registeredDeedNumber: string | null;
  registrationDate: string | null;
  mutationStatus: string | null;
  courtCaseStatus: string | null;
  registrationDeed: MouzaPopupDetail["registrationDeed"];
  mutationCertificate: MouzaPopupDetail["mutationCertificate"];
}> {
  const [
    parcelKhatians,
    parcelOwnership,
    parcelDeeds,
    parcelMutations,
    parcelCourtCases,
    propertyDeed,
    docs,
  ] = await Promise.all([
    db.select().from(khatians).where(eq(khatians.parcelId, property.parcelId)),
    db
      .select({
        ownerName: owners.fullName,
        verificationStatus: ownershipRecords.verificationStatus,
        isCurrent: ownershipRecords.isCurrent,
      })
      .from(ownershipRecords)
      .innerJoin(owners, eq(ownershipRecords.ownerId, owners.id))
      .where(eq(ownershipRecords.parcelId, property.parcelId)),
    db.select().from(deeds).where(eq(deeds.parcelId, property.parcelId)),
    db
      .select()
      .from(mutationCases)
      .where(eq(mutationCases.parcelId, property.parcelId)),
    db
      .select()
      .from(courtCases)
      .where(eq(courtCases.parcelId, property.parcelId)),
    db
      .select()
      .from(propertyDeeds)
      .where(
        and(
          eq(propertyDeeds.propertyId, property.id),
          isNull(propertyDeeds.deletedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: propertyDocuments.id,
        fileName: propertyDocuments.fileName,
        mimeType: propertyDocuments.mimeType,
        categorySlug: documentCategories.slug,
      })
      .from(propertyDocuments)
      .innerJoin(
        documentCategories,
        eq(propertyDocuments.categoryId, documentCategories.id),
      )
      .where(
        and(
          eq(propertyDocuments.propertyId, property.id),
          isNull(propertyDocuments.deletedAt),
          or(
            eq(documentCategories.slug, "deed_copy"),
            eq(documentCategories.slug, "mutation_certificate"),
          ),
        ),
      )
      .orderBy(desc(propertyDocuments.createdAt)),
  ]);

  let registrationDeed: MouzaPopupDetail["registrationDeed"] = null;
  let mutationCertificate: MouzaPopupDetail["mutationCertificate"] = null;
  for (const doc of docs) {
    if (doc.categorySlug === "deed_copy" && !registrationDeed) {
      registrationDeed = {
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      };
    }
    if (doc.categorySlug === "mutation_certificate" && !mutationCertificate) {
      mutationCertificate = {
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      };
    }
  }

  const activeOwners = parcelOwnership.filter((o) => o.isCurrent !== false);
  const statuses = [
    ...new Set(
      activeOwners
        .map((o) => o.verificationStatus)
        .filter((status) => status != null),
    ),
  ];

  return {
    khatianNumbers:
      parcelKhatians.length > 0
        ? parcelKhatians
            .map((k) => `${k.khatianType}: ${k.khatianNumber}`)
            .join(", ")
        : null,
    currentOwners:
      activeOwners.length > 0
        ? activeOwners.map((o) => o.ownerName).join(", ")
        : null,
    ownershipStatus: statuses.length > 0 ? statuses.join(", ") : null,
    ownerCount: activeOwners.length > 0 ? activeOwners.length : null,
    registeredDeedNumber:
      propertyDeed?.deedNumber ?? parcelDeeds[0]?.deedNumber ?? null,
    registrationDate:
      propertyDeed?.registrationDate ??
      parcelDeeds[0]?.registrationDate ??
      null,
    mutationStatus:
      propertyDeed?.namjariStatus ??
      propertyDeed?.mutationCaseNumber ??
      (parcelMutations.length > 0
        ? parcelMutations.map((m) => m.status ?? "not_applied").join(", ")
        : null),
    courtCaseStatus:
      parcelCourtCases.length > 0
        ? parcelCourtCases.map((c) => c.status ?? "ongoing").join(", ")
        : null,
    registrationDeed,
    mutationCertificate,
  };
}

function detailFromKeys(
  keys: GisMatchKeys,
  extras: Partial<MouzaPopupDetail> = {},
): MouzaPopupDetail {
  return {
    plotNo: keys.plotNo,
    mauza: keys.mauza ?? undefined,
    jlNo: keys.jlNo ?? undefined,
    mCode: keys.mCode,
    sheetNo: keys.sheetNo,
    revenueNo: keys.revenueNo,
    project: keys.project,
    mDistrict: keys.district,
    mUpazila: keys.upazila,
    landType: keys.landType,
    landClass: keys.landClass,
    mAcres: keys.mAcres,
    khasArea: keys.khasArea,
    shapeLeng: keys.shapeLeng,
    shapeArea: keys.shapeArea,
    scale: keys.scale,
    prepDate: keys.prepDate,
    syncStatus: extras.propertyId ? "linked" : "unlinked",
    ...extras,
  };
}

/**
 * Resolve a GIS layer feature's attributes to a property popup detail
 * (including registration deed / mutation certificate when linked).
 */
export async function resolvePropertyDetailFromGisAttributes(input: {
  properties: Record<string, unknown>;
  featureId?: string | null;
  coordinates?: string | null;
  layerName?: string | null;
}): Promise<MouzaPopupDetail | null> {
  const keys = extractGisMatchKeys(input.properties);
  if (!keys.plotNo) return null;

  // Prefer mouza GIS record when attributes already sync through that pipeline.
  if (keys.mauza) {
    const [gisRecord] = await db
      .select({
        mouzaId: mouzaGisRecords.mouzaId,
        plotNo: mouzaGisRecords.plotNo,
      })
      .from(mouzaGisRecords)
      .where(
        and(
          eq(mouzaGisRecords.plotNo, keys.plotNo),
          ilike(mouzaGisRecords.mauza, keys.mauza),
        ),
      )
      .limit(1);

    if (gisRecord?.mouzaId) {
      const detail = await getMouzaGisDetail(
        gisRecord.mouzaId,
        gisRecord.plotNo ?? keys.plotNo,
      );
      if (detail) {
        return {
          ...detail,
          coordinates: detail.coordinates ?? input.coordinates ?? null,
          featureId: detail.featureId ?? input.featureId ?? null,
          syncStatus: detail.propertyId
            ? detail.syncStatus
            : detail.syncStatus ?? "partial",
        };
      }
    }
  }

  const matches = await findMatchingProperties(keys);
  const property = matches[0];
  if (!property) {
    return detailFromKeys(keys, {
      featureId: input.featureId,
      coordinates: input.coordinates,
      syncStatus: "unlinked",
      syncMessage: "No matching property found for this GIS feature",
    });
  }

  const fields = await loadPropertyPopupFields(property);

  return detailFromKeys(keys, {
    id: property.id,
    propertyId: property.id,
    propertyCode: property.propertyCode,
    parcelId: property.parcelId,
    plotNo: property.plotNumber ?? keys.plotNo,
    mauza: property.mouzaName ?? keys.mauza ?? undefined,
    jlNo: property.jlNumber ?? keys.jlNo ?? undefined,
    mDistrict: property.districtName ?? keys.district,
    mUpazila: property.upazilaName ?? keys.upazila,
    mAcres: keys.mAcres ?? property.areaAcre,
    featureId: input.featureId,
    coordinates: input.coordinates,
    syncStatus: "linked",
    syncMessage: input.layerName
      ? `Linked from GIS layer ${input.layerName}`
      : "Linked from GIS layer attributes",
    ...fields,
  });
}

export type GisLayerFeatureMatch = {
  featureId: string;
  mapId: string;
  layerId: string;
  layerName: string;
  properties: Record<string, unknown>;
  coordinates: string | null;
  geometryType: string | null;
  hasGeometry: boolean;
};

/**
 * Find an uploaded GIS layer feature that matches property location fields.
 */
export async function findGisLayerFeatureForLocation(input: {
  plotNumber?: string | null;
  mouzaName?: string | null;
  districtName?: string | null;
  upazilaName?: string | null;
}): Promise<GisLayerFeatureMatch | null> {
  const plotNo = normalizePlotNo(input.plotNumber);
  if (!plotNo) return null;

  const mauza = input.mouzaName?.trim() || null;
  const district = input.districtName?.trim() || null;
  const upazila = input.upazilaName?.trim() || null;

  const result = await db.execute(sql`
    SELECT
      f.id,
      f.properties,
      l.id AS layer_id,
      l.layer_name,
      l.map_id,
      ST_GeometryType(f.geom) AS geometry_type,
      ST_X(ST_Centroid(f.geom)) AS centroid_lng,
      ST_Y(ST_Centroid(f.geom)) AS centroid_lat
    FROM gis_layer_features f
    INNER JOIN gis_layers l ON l.id = f.layer_id
    WHERE f.geom IS NOT NULL
      AND (
        f.properties->>'Plot_No' = ${plotNo}
        OR f.properties->>'Plot No' = ${plotNo}
        OR f.properties->>'PLOT_NO' = ${plotNo}
        OR f.properties->>'Dag_No' = ${plotNo}
      )
      AND (
        ${mauza}::text IS NULL
        OR f.properties->>'Mauza' ILIKE ${mauza}
        OR f.properties->>'Mouza' ILIKE ${mauza}
        OR f.properties->>'MAUZA' ILIKE ${mauza}
      )
      AND (
        ${district}::text IS NULL
        OR f.properties->>'M_District' ILIKE ${district}
        OR f.properties->>'M District' ILIKE ${district}
        OR f.properties->>'District' ILIKE ${district}
      )
      AND (
        ${upazila}::text IS NULL
        OR f.properties->>'M_Upazila' ILIKE ${upazila}
        OR f.properties->>'M Upazila' ILIKE ${upazila}
        OR f.properties->>'Upazila' ILIKE ${upazila}
      )
    ORDER BY
      CASE
        WHEN f.properties->>'Mauza' ILIKE ${mauza ?? ""} THEN 0
        WHEN f.properties->>'Mouza' ILIKE ${mauza ?? ""} THEN 0
        ELSE 1
      END,
      f.created_at DESC
    LIMIT 1
  `);

  const rows =
    "rows" in result
      ? (result.rows as Array<{
          id: string;
          properties: Record<string, unknown>;
          layer_id: string;
          layer_name: string;
          map_id: string;
          geometry_type: string | null;
          centroid_lng: number | null;
          centroid_lat: number | null;
        }>)
      : (result as unknown as Array<{
          id: string;
          properties: Record<string, unknown>;
          layer_id: string;
          layer_name: string;
          map_id: string;
          geometry_type: string | null;
          centroid_lng: number | null;
          centroid_lat: number | null;
        }>);

  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) return null;

  return {
    featureId: row.id,
    mapId: row.map_id,
    layerId: row.layer_id,
    layerName: row.layer_name,
    properties: row.properties ?? {},
    coordinates:
      row.centroid_lat != null && row.centroid_lng != null
        ? formatCoordinates(row.centroid_lng, row.centroid_lat)
        : null,
    geometryType: row.geometry_type?.replace(/^ST_/, "") ?? null,
    hasGeometry: true,
  };
}

export async function getGisLayerFeatureCentroid(featureId: string): Promise<{
  lng: number;
  lat: number;
} | null> {
  const result = await db.execute(sql`
    SELECT
      ST_X(ST_Centroid(geom)) AS lng,
      ST_Y(ST_Centroid(geom)) AS lat
    FROM gis_layer_features
    WHERE id = ${featureId}::uuid
    LIMIT 1
  `);

  const rows =
    "rows" in result
      ? (result.rows as Array<{ lng: number | null; lat: number | null }>)
      : (result as unknown as Array<{ lng: number | null; lat: number | null }>);
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (row?.lng == null || row?.lat == null) return null;
  return { lng: Number(row.lng), lat: Number(row.lat) };
}
