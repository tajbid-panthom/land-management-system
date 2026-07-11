import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  properties,
  propertyLocations,
  propertyDeeds,
  propertyDeedVersions,
  planningInformation,
  inheritanceInformation,
  ownershipHistory,
  coOwners,
  propertyDocuments,
  documentCategories,
  propertyReports,
  downloadLogs,
  landParcels,
  khatians,
  mouzas,
  unions,
  upazilas,
  districts,
  divisions,
  owners,
  ownershipRecords,
  userOwnerLinks,
} from "@/lib/db/schema";
import type { propertyFilterSchema } from "./validations";
import type { z } from "zod";
import {
  buildQrPayload,
  convertAreaToAllUnits,
  generatePropertyCode,
} from "./utils";

type PropertyFilters = z.infer<typeof propertyFilterSchema>;

function sortColumn(sortBy?: string) {
  switch (sortBy) {
    case "propertyCode":
      return properties.propertyCode;
    case "status":
      return properties.status;
    case "plotNumber":
      return propertyLocations.plotNumber;
    case "createdAt":
    default:
      return properties.createdAt;
  }
}

export async function listProperties(filters: PropertyFilters) {
  const {
    page,
    limit,
    sortBy,
    sortOrder,
    includeDeleted,
    search,
    divisionId,
    districtId,
    upazilaId,
    unionId,
    mouzaId,
    mouzaName,
    jlNumber,
    khatianNumber,
    plotNumber,
    deedNumber,
    status,
    dateFrom,
    dateTo,
    areaMin,
    areaMax,
    verificationStatus,
    landUse,
    mutationStatus,
    ownerName,
    ownerNid,
  } = filters;

  const conditions = [];
  if (!includeDeleted) {
    conditions.push(isNull(properties.deletedAt));
  }
  if (status) conditions.push(eq(properties.status, status));
  if (divisionId) conditions.push(eq(propertyLocations.divisionId, divisionId));
  if (districtId) conditions.push(eq(propertyLocations.districtId, districtId));
  if (upazilaId) conditions.push(eq(propertyLocations.upazilaId, upazilaId));
  if (unionId) conditions.push(eq(propertyLocations.unionId, unionId));
  if (mouzaId) conditions.push(eq(propertyLocations.mouzaId, mouzaId));
  if (mouzaName)
    conditions.push(ilike(propertyLocations.mouzaName, `%${mouzaName}%`));
  if (jlNumber)
    conditions.push(ilike(propertyLocations.jlNumber, `%${jlNumber}%`));
  if (plotNumber)
    conditions.push(ilike(propertyLocations.plotNumber, `%${plotNumber}%`));
  if (dateFrom) conditions.push(gte(properties.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(properties.createdAt, new Date(dateTo)));
  if (areaMin)
    conditions.push(
      gte(sql`CAST(${propertyLocations.areaDecimal} AS numeric)`, areaMin),
    );
  if (areaMax)
    conditions.push(
      lte(sql`CAST(${propertyLocations.areaDecimal} AS numeric)`, areaMax),
    );
  if (search) {
    conditions.push(
      or(
        ilike(properties.propertyCode, `%${search}%`),
        ilike(propertyLocations.plotNumber, `%${search}%`),
        ilike(propertyLocations.mouzaName, `%${search}%`),
      ),
    );
  }

  let propertyIdsFromKhatian: string[] | null = null;
  if (khatianNumber) {
    const rows = await db
      .select({ propertyId: properties.id })
      .from(properties)
      .innerJoin(landParcels, eq(properties.parcelId, landParcels.id))
      .innerJoin(khatians, eq(khatians.parcelId, landParcels.id))
      .where(ilike(khatians.khatianNumber, `%${khatianNumber}%`));
    propertyIdsFromKhatian = rows.map((r) => r.propertyId);
    if (propertyIdsFromKhatian.length === 0) {
      return { items: [], total: 0, page, limit };
    }
    conditions.push(inArray(properties.id, propertyIdsFromKhatian));
  }

  if (deedNumber) {
    const deedRows = await db
      .select({ propertyId: propertyDeeds.propertyId })
      .from(propertyDeeds)
      .where(ilike(propertyDeeds.deedNumber, `%${deedNumber}%`));
    const ids = deedRows.map((r) => r.propertyId);
    if (ids.length === 0) return { items: [], total: 0, page, limit };
    conditions.push(inArray(properties.id, ids));
  }

  if (landUse) {
    const planningRows = await db
      .select({ propertyId: planningInformation.propertyId })
      .from(planningInformation)
      .where(
        or(
          ilike(planningInformation.existingLandUse, `%${landUse}%`),
          ilike(planningInformation.proposedLandUse, `%${landUse}%`),
        ),
      );
    const ids = planningRows.map((r) => r.propertyId);
    if (ids.length === 0) return { items: [], total: 0, page, limit };
    conditions.push(inArray(properties.id, ids));
  }

  if (mutationStatus) {
    const inhRows = await db
      .select({ propertyId: inheritanceInformation.propertyId })
      .from(inheritanceInformation)
      .where(eq(inheritanceInformation.mutationStatus, mutationStatus as "pending" | "approved" | "rejected"));
    const ids = inhRows.map((r) => r.propertyId);
    if (ids.length === 0) return { items: [], total: 0, page, limit };
    conditions.push(inArray(properties.id, ids));
  }

  if (ownerName || ownerNid || verificationStatus) {
    const ownerConditions = [];
    if (ownerName)
      ownerConditions.push(ilike(owners.fullName, `%${ownerName}%`));
    if (ownerNid)
      ownerConditions.push(ilike(owners.nidNumberEncrypted, `%${ownerNid}%`));
    if (verificationStatus)
      ownerConditions.push(
        eq(ownershipRecords.verificationStatus, verificationStatus as "pending" | "under_review" | "verified" | "rejected" | "disputed"),
      );

    const ownerRows = await db
      .select({ parcelId: ownershipRecords.parcelId })
      .from(ownershipRecords)
      .innerJoin(owners, eq(ownershipRecords.ownerId, owners.id))
      .where(
        and(eq(ownershipRecords.isCurrent, true), ...ownerConditions),
      );

    const parcelIds = ownerRows.map((r) => r.parcelId);
    if (parcelIds.length === 0) return { items: [], total: 0, page, limit };

    const propRows = await db
      .select({ id: properties.id })
      .from(properties)
      .where(inArray(properties.parcelId, parcelIds));
    conditions.push(
      inArray(
        properties.id,
        propRows.map((p) => p.id),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const orderFn = sortOrder === "asc" ? asc : desc;
  const offset = (page - 1) * limit;

  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: properties.id,
        propertyCode: properties.propertyCode,
        status: properties.status,
        parcelId: properties.parcelId,
        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,
        deletedAt: properties.deletedAt,
        plotNumber: propertyLocations.plotNumber,
        mouzaName: propertyLocations.mouzaName,
        jlNumber: propertyLocations.jlNumber,
        districtName: districts.name,
        areaDecimal: propertyLocations.areaDecimal,
      })
      .from(properties)
      .innerJoin(
        propertyLocations,
        eq(propertyLocations.propertyId, properties.id),
      )
      .leftJoin(districts, eq(propertyLocations.districtId, districts.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn(sortBy)))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(properties)
      .innerJoin(
        propertyLocations,
        eq(propertyLocations.propertyId, properties.id),
      )
      .where(whereClause),
  ]);

  return { items, total: totalRow?.total ?? 0, page, limit };
}

export async function getPropertyDetail(id: string) {
  const [property] = await db
    .select({
      id: properties.id,
      propertyCode: properties.propertyCode,
      qrCodePayload: properties.qrCodePayload,
      status: properties.status,
      parcelId: properties.parcelId,
      createdAt: properties.createdAt,
      updatedAt: properties.updatedAt,
      deletedAt: properties.deletedAt,
      plotNumber: propertyLocations.plotNumber,
      mouzaName: propertyLocations.mouzaName,
      jlNumber: propertyLocations.jlNumber,
      unionName: unions.name,
      upazilaName: upazilas.name,
      districtName: districts.name,
      divisionName: divisions.name,
      areaDecimal: propertyLocations.areaDecimal,
      areaAcre: propertyLocations.areaAcre,
      areaHectare: propertyLocations.areaHectare,
      areaSqft: propertyLocations.areaSqft,
      khatianCs: propertyLocations.khatianCs,
      khatianSa: propertyLocations.khatianSa,
      khatianRs: propertyLocations.khatianRs,
      khatianBs: propertyLocations.khatianBs,
      mouzaId: propertyLocations.mouzaId,
      districtId: propertyLocations.districtId,
      divisionId: propertyLocations.divisionId,
      upazilaId: propertyLocations.upazilaId,
      unionId: propertyLocations.unionId,
    })
    .from(properties)
    .innerJoin(
      propertyLocations,
      eq(propertyLocations.propertyId, properties.id),
    )
    .innerJoin(mouzas, eq(propertyLocations.mouzaId, mouzas.id))
    .innerJoin(unions, eq(mouzas.unionId, unions.id))
    .innerJoin(upazilas, eq(unions.upazilaId, upazilas.id))
    .innerJoin(districts, eq(upazilas.districtId, districts.id))
    .leftJoin(divisions, eq(districts.divisionId, divisions.id))
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) return null;

  const [
    deed,
    deedVersions,
    planning,
    inheritance,
    history,
    coOwnerRows,
    docs,
    reports,
    ownership,
    parcelKhatians,
  ] = await Promise.all([
    db
      .select()
      .from(propertyDeeds)
      .where(eq(propertyDeeds.propertyId, id))
      .limit(1),
    db
      .select()
      .from(propertyDeedVersions)
      .innerJoin(
        propertyDeeds,
        eq(propertyDeedVersions.propertyDeedId, propertyDeeds.id),
      )
      .where(eq(propertyDeeds.propertyId, id))
      .orderBy(desc(propertyDeedVersions.version)),
    db
      .select()
      .from(planningInformation)
      .where(eq(planningInformation.propertyId, id))
      .limit(1),
    db
      .select()
      .from(inheritanceInformation)
      .where(eq(inheritanceInformation.propertyId, id))
      .limit(1),
    db
      .select()
      .from(ownershipHistory)
      .where(
        and(
          eq(ownershipHistory.propertyId, id),
          isNull(ownershipHistory.deletedAt),
        ),
      )
      .orderBy(desc(ownershipHistory.transferDate)),
    db
      .select()
      .from(coOwners)
      .where(
        and(eq(coOwners.propertyId, id), isNull(coOwners.deletedAt)),
      ),
    db
      .select({
        id: propertyDocuments.id,
        fileName: propertyDocuments.fileName,
        mimeType: propertyDocuments.mimeType,
        fileSizeBytes: propertyDocuments.fileSizeBytes,
        version: propertyDocuments.version,
        createdAt: propertyDocuments.createdAt,
        categoryName: documentCategories.name,
        categorySlug: documentCategories.slug,
      })
      .from(propertyDocuments)
      .leftJoin(
        documentCategories,
        eq(propertyDocuments.categoryId, documentCategories.id),
      )
      .where(
        and(
          eq(propertyDocuments.propertyId, id),
          isNull(propertyDocuments.deletedAt),
        ),
      )
      .orderBy(desc(propertyDocuments.createdAt)),
    db
      .select()
      .from(propertyReports)
      .where(
        and(
          eq(propertyReports.propertyId, id),
          isNull(propertyReports.deletedAt),
        ),
      ),
    db
      .select({
        id: ownershipRecords.id,
        sharePercentage: ownershipRecords.sharePercentage,
        verificationStatus: ownershipRecords.verificationStatus,
        isCurrent: ownershipRecords.isCurrent,
        effectiveFrom: ownershipRecords.effectiveFrom,
        effectiveTo: ownershipRecords.effectiveTo,
        acquisitionMethod: ownershipRecords.acquisitionMethod,
        ownerName: owners.fullName,
        ownerId: owners.id,
        phone: owners.phone,
        email: owners.email,
        fatherOrHusbandName: owners.fatherOrHusbandName,
        motherName: owners.motherName,
        dateOfBirth: owners.dateOfBirth,
      })
      .from(ownershipRecords)
      .innerJoin(owners, eq(ownershipRecords.ownerId, owners.id))
      .where(eq(ownershipRecords.parcelId, property.parcelId)),
    db
      .select()
      .from(khatians)
      .where(eq(khatians.parcelId, property.parcelId)),
  ]);

  return {
    property,
    deed: deed[0] ?? null,
    deedVersions,
    planning: planning[0] ?? null,
    inheritance: inheritance[0] ?? null,
    ownershipHistory: history,
    coOwners: coOwnerRows,
    documents: docs,
    reports,
    ownership,
    khatians: parcelKhatians,
  };
}

export async function getOwnerPropertyIds(userId: string): Promise<string[]> {
  const links = await db
    .select({ ownerId: userOwnerLinks.ownerId })
    .from(userOwnerLinks)
    .where(eq(userOwnerLinks.userId, userId));

  if (links.length === 0) return [];

  const ownerIds = links.map((l) => l.ownerId);
  const records = await db
    .select({ parcelId: ownershipRecords.parcelId })
    .from(ownershipRecords)
    .where(
      and(
        inArray(ownershipRecords.ownerId, ownerIds),
        eq(ownershipRecords.isCurrent, true),
      ),
    );

  if (records.length === 0) return [];

  const parcelIds = records.map((r) => r.parcelId);
  const props = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(inArray(properties.parcelId, parcelIds), isNull(properties.deletedAt)),
    );

  return props.map((p) => p.id);
}

export async function userOwnsProperty(
  userId: string,
  propertyId: string,
): Promise<boolean> {
  const ownedIds = await getOwnerPropertyIds(userId);
  return ownedIds.includes(propertyId);
}

export async function getNextPropertySequence(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(properties);
  return (row?.total ?? 0) + 1;
}

export async function createPropertyWithParcel(
  input: {
    status?: "active" | "pending" | "disputed" | "archived";
    location: {
      mouzaId: string;
      plotNumber: string;
      areaValue: string;
      areaUnit: "decimal" | "acre" | "hectare" | "sqft" | "katha" | "bigha";
      divisionId?: string;
      districtId?: string;
      upazilaId?: string;
      unionId?: string;
      mouzaName?: string;
      jlNumber?: string;
      khatianCs?: string;
      khatianSa?: string;
      khatianRs?: string;
      khatianBs?: string;
    };
    deed?: {
      deedNumber: string;
      registrationDate: string;
      mutationCaseNumber?: string;
      namjariStatus?: string;
      powerOfAttorney?: string;
      litigationStatus?: string;
    };
  },
  userId: string,
) {
  const sequence = await getNextPropertySequence();
  const propertyCode = generatePropertyCode(sequence);
  const areas = convertAreaToAllUnits(
    parseFloat(input.location.areaValue),
    input.location.areaUnit,
  );

  return db.transaction(async (tx) => {
    const [parcel] = await tx
      .insert(landParcels)
      .values({
        mouzaId: input.location.mouzaId,
        plotNumber: input.location.plotNumber,
        areaValue: input.location.areaValue,
        areaUnit: input.location.areaUnit,
        status: input.status ?? "active",
      })
      .returning();

    const khatianEntries = [
      { type: "CS" as const, number: input.location.khatianCs },
      { type: "SA" as const, number: input.location.khatianSa },
      { type: "RS" as const, number: input.location.khatianRs },
      { type: "BS" as const, number: input.location.khatianBs },
    ].filter((k) => k.number);

    if (khatianEntries.length > 0) {
      await tx.insert(khatians).values(
        khatianEntries.map((k) => ({
          parcelId: parcel.id,
          khatianType: k.type,
          khatianNumber: k.number!,
        })),
      );
    }

    const [property] = await tx
      .insert(properties)
      .values({
        parcelId: parcel.id,
        propertyCode,
        qrCodePayload: buildQrPayload(propertyCode),
        status: input.status ?? "active",
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await tx.insert(propertyLocations).values({
      propertyId: property.id,
      divisionId: input.location.divisionId,
      districtId: input.location.districtId,
      upazilaId: input.location.upazilaId,
      unionId: input.location.unionId,
      mouzaId: input.location.mouzaId,
      mouzaName: input.location.mouzaName,
      jlNumber: input.location.jlNumber,
      plotNumber: input.location.plotNumber,
      khatianCs: input.location.khatianCs,
      khatianSa: input.location.khatianSa,
      khatianRs: input.location.khatianRs,
      khatianBs: input.location.khatianBs,
      areaDecimal: areas.decimal,
      areaAcre: areas.acre,
      areaHectare: areas.hectare,
      areaSqft: areas.sqft,
    });

    if (input.deed) {
      const [deed] = await tx
        .insert(propertyDeeds)
        .values({
          propertyId: property.id,
          deedNumber: input.deed.deedNumber,
          registrationDate: input.deed.registrationDate,
          mutationCaseNumber: input.deed.mutationCaseNumber,
          namjariStatus: input.deed.namjariStatus,
          powerOfAttorney: input.deed.powerOfAttorney,
          litigationStatus: input.deed.litigationStatus,
          updatedBy: userId,
        })
        .returning();

      await tx.insert(propertyDeedVersions).values({
        propertyDeedId: deed.id,
        version: 1,
        deedNumber: deed.deedNumber,
        registrationDate: deed.registrationDate,
        mutationCaseNumber: deed.mutationCaseNumber,
        namjariStatus: deed.namjariStatus,
        powerOfAttorney: deed.powerOfAttorney,
        litigationStatus: deed.litigationStatus,
        updatedBy: userId,
      });
    }

    await tx.insert(planningInformation).values({ propertyId: property.id });
    await tx.insert(inheritanceInformation).values({ propertyId: property.id });

    return property;
  });
}

export async function logDownload(entry: {
  propertyId?: string;
  documentId?: string;
  reportId?: string;
  userId: string;
  action: string;
  ipAddress?: string;
}) {
  await db.insert(downloadLogs).values({
    propertyId: entry.propertyId,
    documentId: entry.documentId,
    reportId: entry.reportId,
    userId: entry.userId,
    action: entry.action,
    ipAddress: entry.ipAddress,
  });
}

export async function seedDocumentCategories() {
  const categories = [
    { slug: "deed_copy", name: "Deed Copy" },
    { slug: "khatian_copy", name: "Khatian Copy" },
    { slug: "survey_map", name: "Survey Map" },
    { slug: "mutation_certificate", name: "Mutation Certificate" },
    { slug: "court_documents", name: "Court Documents" },
    { slug: "power_of_attorney", name: "Power of Attorney" },
    { slug: "gis_files", name: "GIS Files" },
    { slug: "other", name: "Other Documents" },
  ];

  for (const cat of categories) {
    await db.insert(documentCategories).values(cat).onConflictDoNothing();
  }
}
