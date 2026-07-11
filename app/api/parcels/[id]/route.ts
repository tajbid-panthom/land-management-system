import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
} from "@/lib/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  if (!parcel) {
    return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
  }

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
  ] = await Promise.all([
    db.select().from(khatians).where(eq(khatians.parcelId, id)),
    db
      .select({
        id: ownershipRecords.id,
        sharePercentage: ownershipRecords.sharePercentage,
        verificationStatus: ownershipRecords.verificationStatus,
        isCurrent: ownershipRecords.isCurrent,
        effectiveFrom: ownershipRecords.effectiveFrom,
        ownerName: owners.fullName,
        ownerId: owners.id,
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
  ]);

  return NextResponse.json({
    parcel,
    khatians: parcelKhatians,
    ownership,
    mutations,
    courtCases: cases,
    landUse: uses,
    documents: parcelDocs.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      sensitivityLevel: d.sensitivityLevel,
      storageProvider: d.storageProvider,
      isVerified: d.isVerified,
      createdAt: d.createdAt,
    })),
    mortgages: parcelMortgages,
    acquisitions,
    transactions,
    deeds: parcelDeeds,
  });
}
