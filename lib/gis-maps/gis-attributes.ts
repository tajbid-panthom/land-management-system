/** Client-safe GIS attribute parsing (no DB imports). */

export type GisMatchKeys = {
  plotNo: string | null;
  mauza: string | null;
  mCode: string | null;
  jlNo: string | null;
  district: string | null;
  upazila: string | null;
  landType: string | null;
  landClass: string | null;
  mAcres: string | null;
  khasArea: string | null;
  sheetNo: string | null;
  revenueNo: string | null;
  project: string | null;
  scale: string | null;
  prepDate: string | null;
  shapeLeng: string | null;
  shapeArea: string | null;
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-]+/g, "");
}

function attr(
  properties: Record<string, unknown>,
  ...keys: string[]
): string | null {
  const byNorm = new Map<string, unknown>();
  for (const [key, value] of Object.entries(properties)) {
    byNorm.set(normalizeKey(key), value);
  }

  for (const key of keys) {
    const value = byNorm.get(normalizeKey(key));
    if (value == null) continue;
    const text = String(value).trim();
    if (text !== "" && text.toLowerCase() !== "null") return text;
  }
  return null;
}

/** Normalize plot numbers like "1507", "1507.0", " 1507 ". */
export function normalizePlotNo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && /^\d+(\.0+)?$/.test(trimmed)) {
    return String(Math.trunc(asNumber));
  }
  return trimmed;
}

export function extractGisMatchKeys(
  properties: Record<string, unknown>,
): GisMatchKeys {
  return {
    plotNo: normalizePlotNo(
      attr(properties, "Plot_No", "Plot No", "PLOT_NO", "Dag_No", "DAG_NO"),
    ),
    mauza: attr(properties, "Mauza", "Mouza", "MAUZA", "MOUZA"),
    mCode: attr(properties, "M_Code", "M Code", "MCODE", "M_CODE"),
    jlNo: attr(properties, "Jl_No", "Jl No", "JL_NO", "JL No"),
    district: attr(
      properties,
      "M_District",
      "M District",
      "District",
      "DISTRICT",
    ),
    upazila: attr(
      properties,
      "M_Upazila",
      "M Upazila",
      "Upazila",
      "Thana",
      "UPAZILA",
    ),
    landType: attr(properties, "Land_Type", "Land Type", "LAND_TYPE"),
    landClass: attr(properties, "Land_Class", "Land Class", "LAND_CLASS"),
    mAcres: attr(properties, "M_Acres", "M Acres", "M_ACRES"),
    khasArea: attr(properties, "Khas_Area", "Khas Area", "KHAS_AREA"),
    sheetNo: attr(properties, "Sheet_No", "Sheet No", "SHEET_NO"),
    revenueNo: attr(properties, "REVENUE_NO", "Revenue_No", "Revenue No"),
    project: attr(properties, "Project", "PROJECT"),
    scale: attr(properties, "Scale", "SCALE"),
    prepDate: attr(properties, "Prep_Date", "Prep Date", "PREP_DATE"),
    shapeLeng: attr(properties, "Shape_Leng", "Shape Leng", "SHAPE_LENG"),
    shapeArea: attr(properties, "Shape_Area", "Shape Area", "SHAPE_AREA"),
  };
}
