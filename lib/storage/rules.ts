import type { documentTypeEnum } from "@/lib/db/schema/documents";

type DocumentType = (typeof documentTypeEnum.enumValues)[number];

const CLOUDINARY_TYPES: DocumentType[] = [
  "mouza_map",
  "plot_map",
  "gis_map",
  "property_photo",
];

const R2_TYPES: DocumentType[] = [
  "khatian_copy",
  "deed_copy",
  "mutation_certificate",
  "court_document",
  "survey_record",
  "generated_report",
];

export function resolveStorageForDocumentType(documentType: DocumentType): {
  provider: "cloudinary" | "r2";
  sensitivity: "public" | "restricted" | "confidential";
} {
  if (CLOUDINARY_TYPES.includes(documentType)) {
    return {
      provider: "cloudinary",
      sensitivity: documentType === "property_photo" ? "public" : "restricted",
    };
  }

  if (R2_TYPES.includes(documentType)) {
    return {
      provider: "r2",
      sensitivity:
        documentType === "generated_report" ? "restricted" : "confidential",
    };
  }

  return { provider: "r2", sensitivity: "confidential" };
}
