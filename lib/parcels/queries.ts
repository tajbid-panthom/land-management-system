import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  landParcels,
  mouzas,
  unions,
  upazilas,
  districts,
  khatians,
  ownershipRecords,
  owners,
  mutationCases,
  courtCases,
  landUse,
  documents,
  mortgages,
  landAcquisition,
  landTransactions,
  deeds,
  powerOfAttorney,
  properties,
} from "@/lib/db/schema";

export async function getParcelDetail(id: string) {
  const [parcel] = await db
    .select({
      id: landParcels.id,
      plotNumber: landParcels.plotNumber,
      areaValue: landParcels.areaValue,
      areaUnit: landParcels.areaUnit,
      status: landParcels.status,
      mouzaId: landParcels.mouzaId,
      mouzaName: mouzas.name,
      jlNumber: mouzas.jlNumber,
      unionName: unions.name,
      upazilaName: upazilas.name,
      districtName: districts.name,
      createdAt: landParcels.createdAt,
      updatedAt: landParcels.updatedAt,
    })
    .from(landParcels)
    .innerJoin(mouzas, eq(landParcels.mouzaId, mouzas.id))
    .innerJoin(unions, eq(mouzas.unionId, unions.id))
    .innerJoin(upazilas, eq(unions.upazilaId, upazilas.id))
    .innerJoin(districts, eq(upazilas.districtId, districts.id))
    .where(eq(landParcels.id, id))
    .limit(1);

  if (!parcel) return null;

  const [
    parcelKhatians,
    ownership,
    mutations,
    cases,
    uses,
    parcelDocs,
    parcelMortgages,
    acquisitions,
    transactions,
    parcelDeeds,
    poa,
  ] = await Promise.all([
    db.select().from(khatians).where(eq(khatians.parcelId, id)),
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
      })
      .from(ownershipRecords)
      .innerJoin(owners, eq(ownershipRecords.ownerId, owners.id))
      .where(eq(ownershipRecords.parcelId, id)),
    db.select().from(mutationCases).where(eq(mutationCases.parcelId, id)),
    db.select().from(courtCases).where(eq(courtCases.parcelId, id)),
    db.select().from(landUse).where(eq(landUse.parcelId, id)),
    db.select().from(documents).where(eq(documents.parcelId, id)),
    db.select().from(mortgages).where(eq(mortgages.parcelId, id)),
    db.select().from(landAcquisition).where(eq(landAcquisition.parcelId, id)),
    db.select().from(landTransactions).where(eq(landTransactions.parcelId, id)),
    db.select().from(deeds).where(eq(deeds.parcelId, id)),
    db.select().from(powerOfAttorney).where(eq(powerOfAttorney.parcelId, id)),
  ]);

  return {
    parcel,
    khatians: parcelKhatians,
    ownership,
    mutations,
    courtCases: cases,
    landUse: uses,
    documents: parcelDocs,
    mortgages: parcelMortgages,
    acquisitions,
    transactions,
    deeds: parcelDeeds,
    powerOfAttorney: poa,
  };
}

export async function listParcels() {
  return db
    .select({
      id: landParcels.id,
      plotNumber: landParcels.plotNumber,
      areaValue: landParcels.areaValue,
      areaUnit: landParcels.areaUnit,
      status: landParcels.status,
      mouzaName: mouzas.name,
      districtName: districts.name,
    })
    .from(landParcels)
    .innerJoin(mouzas, eq(landParcels.mouzaId, mouzas.id))
    .innerJoin(unions, eq(mouzas.unionId, unions.id))
    .innerJoin(upazilas, eq(unions.upazilaId, upazilas.id))
    .innerJoin(districts, eq(upazilas.districtId, districts.id))
    .limit(100);
}

export async function listMutationCases() {
  return db
    .select({
      id: mutationCases.id,
      caseNumber: mutationCases.caseNumber,
      status: mutationCases.status,
      appliedDate: mutationCases.appliedDate,
      decisionDate: mutationCases.decisionDate,
      remarks: mutationCases.remarks,
      plotNumber: landParcels.plotNumber,
      parcelId: landParcels.id,
      mouzaName: mouzas.name,
      districtName: districts.name,
      propertyId: properties.id,
    })
    .from(mutationCases)
    .innerJoin(landParcels, eq(mutationCases.parcelId, landParcels.id))
    .innerJoin(mouzas, eq(landParcels.mouzaId, mouzas.id))
    .innerJoin(unions, eq(mouzas.unionId, unions.id))
    .innerJoin(upazilas, eq(unions.upazilaId, upazilas.id))
    .innerJoin(districts, eq(upazilas.districtId, districts.id))
    .leftJoin(
      properties,
      and(
        eq(properties.parcelId, landParcels.id),
        isNull(properties.deletedAt),
      ),
    )
    .limit(100);
}

export async function listVerificationQueue() {
  return db
    .select({
      id: ownershipRecords.id,
      verificationStatus: ownershipRecords.verificationStatus,
      sharePercentage: ownershipRecords.sharePercentage,
      effectiveFrom: ownershipRecords.effectiveFrom,
      ownerName: owners.fullName,
      plotNumber: landParcels.plotNumber,
      parcelId: landParcels.id,
      mouzaName: mouzas.name,
      districtName: districts.name,
      propertyId: properties.id,
    })
    .from(ownershipRecords)
    .innerJoin(owners, eq(ownershipRecords.ownerId, owners.id))
    .innerJoin(landParcels, eq(ownershipRecords.parcelId, landParcels.id))
    .innerJoin(mouzas, eq(landParcels.mouzaId, mouzas.id))
    .innerJoin(unions, eq(mouzas.unionId, unions.id))
    .innerJoin(upazilas, eq(unions.upazilaId, upazilas.id))
    .innerJoin(districts, eq(upazilas.districtId, districts.id))
    .leftJoin(
      properties,
      and(
        eq(properties.parcelId, landParcels.id),
        isNull(properties.deletedAt),
      ),
    )
    .where(eq(ownershipRecords.isCurrent, true))
    .limit(100);
}
