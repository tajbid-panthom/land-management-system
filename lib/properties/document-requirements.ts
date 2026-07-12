import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  properties,
  propertyLocations,
  landParcels,
  mouzas,
  ownershipRecords,
  owners,
} from "@/lib/db/schema";
import { encryptField } from "@/lib/crypto/encryption";

export const PDF_ONLY_DOCUMENT_CATEGORIES = new Set([
  "deed_copy",
  "mutation_certificate",
]);

export type PropertyLocationCompleteness = {
  complete: boolean;
  missing: string[];
  location: {
    divisionId: string | null;
    districtId: string | null;
    upazilaId: string | null;
    mouzaId: string;
    jlNumber: string | null;
    plotNumber: string;
  } | null;
};

export type PropertyOwnerInput = {
  fullName: string;
  fatherOrHusbandName?: string;
  motherName?: string;
  nid?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  sharePercentage?: number;
};

export type PropertyOwnershipCompleteness = {
  complete: boolean;
  missing: string[];
  ownerCount: number;
};

/**
 * Validates that a property has the mandatory hierarchy required
 * before attaching Registration Deed or Mutation Certificate PDFs.
 */
export async function getPropertyLocationCompleteness(
  propertyId: string,
): Promise<PropertyLocationCompleteness> {
  const [row] = await db
    .select({
      divisionId: propertyLocations.divisionId,
      districtId: propertyLocations.districtId,
      upazilaId: propertyLocations.upazilaId,
      mouzaId: propertyLocations.mouzaId,
      jlNumber: propertyLocations.jlNumber,
      plotNumber: propertyLocations.plotNumber,
      mouzaJl: mouzas.jlNumber,
      parcelMouzaId: landParcels.mouzaId,
      parcelPlotNumber: landParcels.plotNumber,
    })
    .from(properties)
    .innerJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .innerJoin(landParcels, eq(properties.parcelId, landParcels.id))
    .leftJoin(mouzas, eq(propertyLocations.mouzaId, mouzas.id))
    .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
    .limit(1);

  if (!row) {
    return { complete: false, missing: ["property"], location: null };
  }

  const jlNumber = row.jlNumber ?? row.mouzaJl;
  const missing: string[] = [];
  if (!row.divisionId) missing.push("Division");
  if (!row.districtId) missing.push("District");
  if (!row.upazilaId) missing.push("Upazila / Thana");
  if (!row.mouzaId) missing.push("Mouza");
  if (!jlNumber) missing.push("JL Number");
  if (!row.plotNumber) missing.push("Plot Number");

  if (
    row.mouzaId &&
    row.parcelMouzaId &&
    row.mouzaId !== row.parcelMouzaId
  ) {
    missing.push("Plot must belong to the selected Mouza");
  }

  if (
    row.plotNumber &&
    row.parcelPlotNumber &&
    row.plotNumber.trim() !== row.parcelPlotNumber.trim()
  ) {
    missing.push("Plot Number must match the GIS parcel");
  }

  return {
    complete: missing.length === 0,
    missing,
    location: {
      divisionId: row.divisionId,
      districtId: row.districtId,
      upazilaId: row.upazilaId,
      mouzaId: row.mouzaId,
      jlNumber,
      plotNumber: row.plotNumber,
    },
  };
}

export async function getPropertyOwnershipCompleteness(
  propertyId: string,
): Promise<PropertyOwnershipCompleteness> {
  const [property] = await db
    .select({ parcelId: properties.parcelId })
    .from(properties)
    .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) {
    return { complete: false, missing: ["property"], ownerCount: 0 };
  }

  const currentOwners = await db
    .select({ id: ownershipRecords.id })
    .from(ownershipRecords)
    .where(
      and(
        eq(ownershipRecords.parcelId, property.parcelId),
        eq(ownershipRecords.isCurrent, true),
      ),
    );

  if (currentOwners.length === 0) {
    return {
      complete: false,
      missing: ["Property owner details"],
      ownerCount: 0,
    };
  }

  return { complete: true, missing: [], ownerCount: currentOwners.length };
}

/** Parse owner fields from a document-upload FormData payload. */
export function parseOwnerInputFromFormData(
  formData: FormData,
): PropertyOwnerInput | null {
  const fullName = String(formData.get("ownerFullName") ?? "").trim();
  if (!fullName) return null;

  const shareRaw = String(formData.get("ownerSharePercentage") ?? "100").trim();
  const sharePercentage = Number(shareRaw || "100");

  const optional = (key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    return value || undefined;
  };

  return {
    fullName,
    fatherOrHusbandName: optional("ownerFatherOrHusbandName"),
    motherName: optional("ownerMotherName"),
    nid: optional("ownerNid"),
    phone: optional("ownerPhone"),
    email: optional("ownerEmail"),
    dateOfBirth: optional("ownerDateOfBirth"),
    sharePercentage: Number.isFinite(sharePercentage) ? sharePercentage : 100,
  };
}

/**
 * Replace current ownership with the submitted primary owner details.
 * Used when uploading property documents.
 */
export async function upsertPrimaryPropertyOwner(
  parcelId: string,
  ownerInput: PropertyOwnerInput,
) {
  const share = ownerInput.sharePercentage ?? 100;
  const today = new Date().toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    await tx
      .update(ownershipRecords)
      .set({ isCurrent: false, effectiveTo: today })
      .where(
        and(
          eq(ownershipRecords.parcelId, parcelId),
          eq(ownershipRecords.isCurrent, true),
        ),
      );

    const [owner] = await tx
      .insert(owners)
      .values({
        fullName: ownerInput.fullName,
        fatherOrHusbandName: ownerInput.fatherOrHusbandName,
        motherName: ownerInput.motherName,
        dateOfBirth: ownerInput.dateOfBirth,
        phone: ownerInput.phone,
        email: ownerInput.email,
        nidNumberEncrypted: ownerInput.nid
          ? encryptField(ownerInput.nid)
          : undefined,
      })
      .returning();

    await tx.insert(ownershipRecords).values({
      parcelId,
      ownerId: owner.id,
      sharePercentage: String(share),
      effectiveFrom: today,
      isCurrent: true,
      verificationStatus: "pending",
    });
  });
}
