import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  landParcels,
  khatians,
  mouzas,
  unions,
  upazilas,
  districts,
  ownershipRecords,
  owners,
  mutationCases,
  courtCases,
  landUse,
  mortgages,
  documents,
  reportJobs,
} from "@/lib/db/schema";
import { uploadToR2, buildR2Key } from "@/lib/storage/r2";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function aggregateParcelReportData(parcelId: string) {
  const [parcel] = await db
    .select({
      id: landParcels.id,
      plotNumber: landParcels.plotNumber,
      areaValue: landParcels.areaValue,
      areaUnit: landParcels.areaUnit,
      status: landParcels.status,
      mouzaName: mouzas.name,
      jlNumber: mouzas.jlNumber,
      unionName: unions.name,
      upazilaName: upazilas.name,
      districtName: districts.name,
    })
    .from(landParcels)
    .innerJoin(mouzas, eq(landParcels.mouzaId, mouzas.id))
    .innerJoin(unions, eq(mouzas.unionId, unions.id))
    .innerJoin(upazilas, eq(unions.upazilaId, upazilas.id))
    .innerJoin(districts, eq(upazilas.districtId, districts.id))
    .where(eq(landParcels.id, parcelId))
    .limit(1);

  if (!parcel) throw new Error("Parcel not found");

  const parcelKhatians = await db
    .select()
    .from(khatians)
    .where(eq(khatians.parcelId, parcelId));

  const currentOwners = await db
    .select({
      fullName: owners.fullName,
      sharePercentage: ownershipRecords.sharePercentage,
      verificationStatus: ownershipRecords.verificationStatus,
    })
    .from(ownershipRecords)
    .innerJoin(owners, eq(ownershipRecords.ownerId, owners.id))
    .where(eq(ownershipRecords.parcelId, parcelId));

  const mutations = await db
    .select()
    .from(mutationCases)
    .where(eq(mutationCases.parcelId, parcelId));

  const cases = await db
    .select()
    .from(courtCases)
    .where(eq(courtCases.parcelId, parcelId));

  const uses = await db
    .select()
    .from(landUse)
    .where(eq(landUse.parcelId, parcelId));

  const activeMortgages = await db
    .select()
    .from(mortgages)
    .where(eq(mortgages.parcelId, parcelId));

  return {
    parcel,
    khatians: parcelKhatians,
    owners: currentOwners,
    mutations,
    courtCases: cases,
    landUse: uses,
    mortgages: activeMortgages,
  };
}

function buildReportText(data: Awaited<ReturnType<typeof aggregateParcelReportData>>): string {
  const lines = [
    "PROPERTY INFORMATION REPORT",
    "===========================",
    "",
    `Plot: ${data.parcel.plotNumber}`,
    `Location: ${data.parcel.mouzaName}, ${data.parcel.unionName}, ${data.parcel.upazilaName}, ${data.parcel.districtName}`,
    `JL Number: ${data.parcel.jlNumber}`,
    `Area: ${data.parcel.areaValue} ${data.parcel.areaUnit}`,
    `Status: ${data.parcel.status}`,
    "",
    "KHATIANS",
    ...data.khatians.map(
      (k) => `  ${k.khatianType}: ${k.khatianNumber}`,
    ),
    "",
    "CURRENT OWNERS",
    ...data.owners.map(
      (o) =>
        `  ${o.fullName} — ${o.sharePercentage}% (${o.verificationStatus})`,
    ),
    "",
    "MUTATION CASES",
    ...data.mutations.map((m) => `  ${m.caseNumber}: ${m.status}`),
    "",
    "COURT CASES",
    ...data.courtCases.map((c) => `  ${c.caseNumber}: ${c.status}`),
    "",
    "LAND USE",
    ...data.landUse.map(
      (u) => `  ${u.category ?? "N/A"} — ${u.existingUse ?? "N/A"}`,
    ),
    "",
    "MORTGAGES",
    ...data.mortgages.map(
      (m) => `  ${m.bankName}: ${m.status} — ${m.chargeAmount ?? "N/A"}`,
    ),
    "",
    `Generated: ${new Date().toISOString()}`,
  ];
  return lines.join("\n");
}

export async function processReportJob(jobId: string, requesterEmail?: string) {
  const [job] = await db
    .select()
    .from(reportJobs)
    .where(eq(reportJobs.id, jobId))
    .limit(1);

  if (!job) throw new Error("Report job not found");

  try {
    await db
      .update(reportJobs)
      .set({ status: "processing" })
      .where(eq(reportJobs.id, jobId));

    const data = await aggregateParcelReportData(job.parcelId);
    const reportContent = buildReportText(data);
    const buffer = Buffer.from(reportContent, "utf-8");

    const key = buildR2Key(job.parcelId, "generated_report", "property-report.txt");
    await uploadToR2(key, buffer, "text/plain");

    const [doc] = await db
      .insert(documents)
      .values({
        parcelId: job.parcelId,
        documentType: "generated_report",
        storageProvider: "r2",
        storageKey: key,
        sensitivityLevel: "restricted",
        mimeType: "text/plain",
        fileSizeBytes: String(buffer.length),
        uploadedBy: job.requestedBy,
      })
      .returning();

    await db
      .update(reportJobs)
      .set({
        status: "completed",
        documentId: doc.id,
        completedAt: new Date(),
      })
      .where(eq(reportJobs.id, jobId));

    if (resend && requesterEmail) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "reports@landmgmt.local",
        to: requesterEmail,
        subject: "Property Information Report Ready",
        text: `Your property report for plot ${data.parcel.plotNumber} is ready. Request a signed download link from the dashboard.`,
      });
    }

    return { jobId, documentId: doc.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Report generation failed";
    await db
      .update(reportJobs)
      .set({ status: "failed", errorMessage: message })
      .where(eq(reportJobs.id, jobId));
    throw error;
  }
}
