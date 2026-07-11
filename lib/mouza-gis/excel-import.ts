import * as XLSX from "xlsx";
import {
  EXCEL_COLUMNS,
  REQUIRED_EXCEL_COLUMNS,
  type ExcelRow,
  type ImportRowError,
} from "./validations";

function normalizeHeader(header: string): string {
  return header.trim().replace(/\s+/g, "_");
}

function toString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

function toNumericString(value: unknown): string | null {
  const s = toString(value);
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return String(n);
}

function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  const excelDate = Number(s);
  if (!Number.isNaN(excelDate) && excelDate > 30000 && excelDate < 60000) {
    const date = XLSX.SSF.parse_date_code(excelDate);
    if (date) {
      const mm = String(date.m).padStart(2, "0");
      const dd = String(date.d).padStart(2, "0");
      return `${date.y}-${mm}-${dd}`;
    }
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function parseExcelBuffer(buffer: Buffer): {
  rows: ExcelRow[];
  headers: string[];
  missingColumns: string[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no worksheets");
  }
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  if (raw.length === 0) {
    throw new Error("Excel file contains no data rows");
  }

  const headerMap = new Map<string, string>();
  for (const key of Object.keys(raw[0] ?? {})) {
    headerMap.set(normalizeHeader(key), key);
  }

  const missingColumns = REQUIRED_EXCEL_COLUMNS.filter(
    (col) => !headerMap.has(col),
  );

  const rows: ExcelRow[] = raw.map((row) => {
    const mapped: ExcelRow = {};
    for (const col of EXCEL_COLUMNS) {
      const sourceKey = headerMap.get(col);
      if (sourceKey) {
        (mapped as Record<string, unknown>)[col] = row[sourceKey];
      }
    }
    return mapped;
  });

  return {
    rows,
    headers: [...headerMap.keys()],
    missingColumns: [...missingColumns],
  };
}

export function validateExcelRow(
  row: ExcelRow,
  rowIndex: number,
): ImportRowError | null {
  for (const col of REQUIRED_EXCEL_COLUMNS) {
    const val = row[col];
    if (val === null || val === undefined || String(val).trim() === "") {
      return { row: rowIndex, message: `Missing required field: ${col}` };
    }
  }
  return null;
}

export function excelRowToDbValues(row: ExcelRow) {
  return {
    plotNo: toString(row.Plot_No),
    mauza: toString(row.Mauza)!,
    jlNo: toString(row.Jl_No)!,
    sheetNo: toString(row.Sheet_No),
    scale: toString(row.Scale),
    revenueNo: toString(row.REVENUE_NO),
    project: toString(row.Project),
    mzVer: toString(row.Mz_Ver),
    mCode: toString(row.M_Code)!,
    layerCode: toString(row.Layer_Code),
    layer: toString(row.Layer),
    mDistrict: toString(row.M_District),
    mUpazila: toString(row.M_Upazila),
    prepDate: toDateString(row.Prep_Date),
    mAcres: toNumericString(row.M_Acres),
    landType: toString(row.Land_Type),
    khasArea: toNumericString(row.Khas_Area),
    landClass: toString(row.Land_Class),
    mauzaJlS: toString(row.Mauza_JL_S)!,
    shapeLeng: toNumericString(row.Shape_Leng),
    shapeArea: toNumericString(row.Shape_Area),
  };
}

/** Normalize DBF field names for matching */
export function normalizeDbfFieldName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, "_");
}

export function extractDbfMatchKeys(
  attrs: Record<string, unknown>,
): {
  mCode: string | null;
  mauzaJlS: string | null;
  jlNo: string | null;
  plotNo: string | null;
  mauza: string | null;
} {
  const normalized = new Map<string, unknown>();
  for (const [k, v] of Object.entries(attrs)) {
    normalized.set(normalizeDbfFieldName(k), v);
  }

  const get = (...keys: string[]) => {
    for (const key of keys) {
      const val = normalized.get(key);
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
    return null;
  };

  return {
    mCode: get("M_CODE", "MCODE", "M_CODE_1"),
    mauzaJlS: get("MAUZA_JL_S", "MAUZA_JLS", "MAUZA_JL"),
    jlNo: get("JL_NO", "JLNO", "JL_NUMBER"),
    plotNo: get("PLOT_NO", "PLOTNO", "PLOT_NUMBER", "DAG_NO"),
    mauza: get("MAUZA", "MOUZA", "MAUZA_NM"),
  };
}
