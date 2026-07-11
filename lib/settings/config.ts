import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/properties/validations";

export const SYSTEM_SETTINGS = {
  maxUploadMb: MAX_FILE_SIZE_BYTES / (1024 * 1024),
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  ownershipShareTotal: 100,
  sessionStrategy: "JWT",
  publicStorageProvider: "Cloudinary",
  confidentialStorageProvider: "Cloudflare R2",
  emailProvider: "Resend",
} as const;

export type IntegrationStatus = {
  database: boolean;
  nextAuth: boolean;
  encryption: boolean;
  cloudinary: boolean;
  r2: boolean;
  resend: boolean;
};

export function getIntegrationStatus(): IntegrationStatus {
  return {
    database: Boolean(process.env.DATABASE_URL),
    nextAuth: Boolean(process.env.NEXTAUTH_SECRET),
    encryption: Boolean(process.env.ENCRYPTION_KEY),
    cloudinary: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    ),
    r2: Boolean(
      process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME,
    ),
    resend: Boolean(process.env.RESEND_API_KEY),
  };
}

export const WORKFLOW_RULES = [
  {
    title: "Mutation workflow",
    steps: [
      "Land officer applies mutation (not_applied → applied → under_hearing)",
      "Approver approves or rejects (under_hearing → approved / rejected)",
      "Applicant email notification sent on final decision when configured",
    ],
  },
  {
    title: "Ownership verification",
    steps: [
      "New ownership records start as pending",
      "Field verifier moves pending → under_review",
      "Approver finalizes as verified, rejected, or disputed",
      "Disputed ownership freezes further ownership changes",
    ],
  },
  {
    title: "Ownership shares",
    steps: [
      "Property ownership updates must total exactly 100%",
      "Co-owner shares must also total 100% when provided",
    ],
  },
] as const;

export const STORAGE_RULES = [
  {
    provider: "Cloudinary",
    types: "Mouza map, plot map, GIS map, property photo",
    sensitivity: "Public / restricted",
  },
  {
    provider: "Cloudflare R2",
    types:
      "Khatian copy, deed copy, mutation certificate, court document, survey record, generated report",
    sensitivity: "Confidential / restricted",
  },
] as const;
