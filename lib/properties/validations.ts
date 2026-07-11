import { z } from "zod";

const nidSchema = z
  .string()
  .regex(/^\d{10}$|^\d{13}$|^\d{17}$/, "NID must be 10, 13, or 17 digits");

const phoneSchema = z
  .string()
  .regex(/^(\+880|0)1[3-9]\d{8}$/, "Invalid Bangladesh mobile number");

const emailSchema = z.string().email("Invalid email address");

export const areaUnitSchema = z.enum([
  "decimal",
  "acre",
  "hectare",
  "sqft",
  "katha",
  "bigha",
]);

export const propertyStatusSchema = z.enum([
  "active",
  "pending",
  "disputed",
  "archived",
]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.coerce.boolean().optional().default(false),
  search: z.string().optional(),
});

export const propertyLocationSchema = z.object({
  divisionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
  unionId: z.string().uuid().optional(),
  mouzaId: z.string().uuid(),
  mouzaName: z.string().max(100).optional(),
  jlNumber: z.string().max(20).optional(),
  plotNumber: z.string().min(1).max(30),
  khatianCs: z.string().max(30).optional(),
  khatianSa: z.string().max(30).optional(),
  khatianRs: z.string().max(30).optional(),
  khatianBs: z.string().max(30).optional(),
  areaDecimal: z.string().optional(),
  areaAcre: z.string().optional(),
  areaHectare: z.string().optional(),
  areaSqft: z.string().optional(),
  areaValue: z.string().min(1),
  areaUnit: areaUnitSchema,
});

export const createPropertySchema = z.object({
  status: propertyStatusSchema.optional(),
  location: propertyLocationSchema,
  deed: z
    .object({
      deedNumber: z.string().min(1).max(40),
      registrationDate: z.string().date(),
      mutationCaseNumber: z.string().max(40).optional(),
      namjariStatus: z.string().max(30).optional(),
      powerOfAttorney: z.string().optional(),
      litigationStatus: z.string().max(50).optional(),
    })
    .optional(),
});

export const updatePropertySchema = z.object({
  status: propertyStatusSchema.optional(),
  location: propertyLocationSchema.partial().optional(),
});

export const propertyFilterSchema = paginationSchema.extend({
  divisionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
  unionId: z.string().uuid().optional(),
  mouzaId: z.string().uuid().optional(),
  mouzaName: z.string().optional(),
  jlNumber: z.string().optional(),
  khatianNumber: z.string().optional(),
  plotNumber: z.string().optional(),
  ownerName: z.string().optional(),
  ownerNid: z.string().optional(),
  deedNumber: z.string().optional(),
  mutationStatus: z.string().optional(),
  landUse: z.string().optional(),
  verificationStatus: z.string().optional(),
  status: propertyStatusSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  areaMin: z.coerce.number().optional(),
  areaMax: z.coerce.number().optional(),
});

export const deedUpdateSchema = z.object({
  deedNumber: z.string().min(1).max(40),
  registrationDate: z.string().date(),
  mutationCaseNumber: z.string().max(40).optional(),
  namjariStatus: z.string().max(30).optional(),
  powerOfAttorney: z.string().optional(),
  litigationStatus: z.string().max(50).optional(),
});

export const ownerInputSchema = z.object({
  fullName: z.string().min(1).max(150),
  nid: nidSchema.optional(),
  dateOfBirth: z.string().date().optional(),
  fatherOrHusbandName: z.string().max(150).optional(),
  motherName: z.string().max(150).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  sharePercentage: z.coerce.number().min(0).max(100),
});

export const coOwnerInputSchema = z.object({
  name: z.string().min(1).max(150),
  relationship: z.string().max(50).optional(),
  ownershipShare: z.coerce.number().min(0).max(100),
  ownerId: z.string().uuid().optional(),
});

export const ownershipHistoryInputSchema = z.object({
  previousOwnerName: z.string().min(1).max(150),
  transferDate: z.string().date(),
  transferType: z.enum([
    "sale",
    "gift",
    "inheritance",
    "partition",
    "court_order",
    "mutation",
    "other",
  ]),
  saleAmount: z.string().optional(),
});

export const ownershipUpdateSchema = z.object({
  owners: z.array(ownerInputSchema).min(1),
  coOwners: z.array(coOwnerInputSchema).optional(),
  history: z.array(ownershipHistoryInputSchema).optional(),
  inheritance: z
    .object({
      isApplicable: z.boolean(),
      legalHeir: z.string().max(150).optional(),
      courtOrder: z.string().optional(),
      mutationStatus: z.enum(["pending", "approved", "rejected"]).optional(),
    })
    .optional(),
}).refine(
  (data) => {
    const total = data.owners.reduce((sum, o) => sum + o.sharePercentage, 0);
    const coTotal =
      data.coOwners?.reduce((sum, c) => sum + c.ownershipShare, 0) ?? 0;
    if (data.coOwners && data.coOwners.length > 0) {
      return Math.abs(coTotal - 100) < 0.01;
    }
    return Math.abs(total - 100) < 0.01;
  },
  { message: "Ownership shares must total 100%" },
);

export const planningUpdateSchema = z.object({
  existingLandUse: z.string().max(50).optional(),
  proposedLandUse: z.string().max(50).optional(),
  zoningClassification: z.string().max(50).optional(),
  isProtectedArea: z.boolean().optional(),
  wetlandStatus: z.string().max(30).optional(),
  masterPlanRef: z.string().max(100).optional(),
  dapInformation: z.string().optional(),
  lapInformation: z.string().optional(),
  buildingRestrictionZone: z.string().max(50).optional(),
});

export const bulkActionSchema = z.object({
  action: z.enum(["delete", "restore", "export"]),
  ids: z.array(z.string().uuid()).min(1),
  format: z.enum(["csv", "json"]).optional(),
});

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const documentUploadSchema = z.object({
  categorySlug: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSizeBytes: z.number().max(MAX_FILE_SIZE_BYTES),
});
