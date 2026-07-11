import { z } from "zod";

export const EXCEL_COLUMNS = [
  "Plot_No",
  "Mauza",
  "Jl_No",
  "Sheet_No",
  "Scale",
  "REVENUE_NO",
  "Project",
  "Mz_Ver",
  "M_Code",
  "Layer_Code",
  "Layer",
  "M_District",
  "M_Upazila",
  "Prep_Date",
  "M_Acres",
  "Land_Type",
  "Khas_Area",
  "Land_Class",
  "Mauza_JL_S",
  "Shape_Leng",
  "Shape_Area",
] as const;

export const REQUIRED_EXCEL_COLUMNS = [
  "Plot_No",
  "Mauza",
  "Jl_No",
  "M_Code",
  "Mauza_JL_S",
] as const;

export const createMouzaSchema = z.object({
  name: z.string().min(1).max(100),
  jlNumber: z.string().min(1).max(20),
  upazilaId: z.string().uuid(),
  unionId: z.string().uuid().optional(),
  mCode: z.string().max(50).optional(),
  datasetId: z.string().uuid().optional(),
  nameBn: z.string().max(100).optional(),
});

export const createDatasetSchema = z.object({
  name: z.string().min(1).max(150),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  districtId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export const mapDatasetSchema = z.object({
  datasetId: z.string().uuid(),
});

export type ExcelRow = {
  Plot_No?: string | number;
  Mauza?: string;
  Jl_No?: string | number;
  Sheet_No?: string | number;
  Scale?: string | number;
  REVENUE_NO?: string | number;
  Project?: string;
  Mz_Ver?: string | number;
  M_Code?: string | number;
  Layer_Code?: string | number;
  Layer?: string;
  M_District?: string;
  M_Upazila?: string;
  Prep_Date?: string | number | Date;
  M_Acres?: string | number;
  Land_Type?: string;
  Khas_Area?: string | number;
  Land_Class?: string;
  Mauza_JL_S?: string;
  Shape_Leng?: string | number;
  Shape_Area?: string | number;
};

export type ImportRowError = {
  row: number;
  message: string;
  mCode?: string;
  plotNo?: string;
};

export type SyncRecordReport = {
  recordId?: string;
  mCode: string;
  plotNo: string | null;
  mauza?: string;
  status:
    | "synced"
    | "updated"
    | "skipped"
    | "failed"
    | "geometry_missing"
    | "duplicate_geometry"
    | "unmatched";
  reason?: string;
};

export type SynchronizeReport = {
  synced: number;
  updated: number;
  skipped: number;
  failed: number;
  geometryMissing: number;
  duplicateGeometries: number;
  unmatchedRecords: number;
  unmatchedFeatures: number;
  records: SyncRecordReport[];
  errors: string[];
};

export type ImportResult = {
  importId: string;
  total: number;
  success: number;
  errors: ImportRowError[];
  updated: number;
  inserted: number;
  skipped: number;
  failed: number;
  sync: SynchronizeReport | null;
};
