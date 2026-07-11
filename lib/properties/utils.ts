const DECIMAL_TO_ACRE = 0.01;
const DECIMAL_TO_HECTARE = 0.00404686;
const DECIMAL_TO_SQFT = 435.6;

export function convertAreaToAllUnits(
  value: number,
  unit: "decimal" | "acre" | "hectare" | "sqft" | "katha" | "bigha",
): {
  decimal: string;
  acre: string;
  hectare: string;
  sqft: string;
} {
  let decimal = value;
  switch (unit) {
    case "acre":
      decimal = value / DECIMAL_TO_ACRE;
      break;
    case "hectare":
      decimal = value / DECIMAL_TO_HECTARE;
      break;
    case "sqft":
      decimal = value / DECIMAL_TO_SQFT;
      break;
    case "katha":
      decimal = value / 0.05;
      break;
    case "bigha":
      decimal = value / 0.33;
      break;
    default:
      break;
  }

  return {
    decimal: decimal.toFixed(4),
    acre: (decimal * DECIMAL_TO_ACRE).toFixed(4),
    hectare: (decimal * DECIMAL_TO_HECTARE).toFixed(4),
    sqft: (decimal * DECIMAL_TO_SQFT).toFixed(2),
  };
}

export function generatePropertyCode(sequence: number): string {
  const year = new Date().getFullYear();
  return `PROP-${year}-${String(sequence).padStart(6, "0")}`;
}

export function buildQrPayload(propertyCode: string, baseUrl?: string): string {
  const origin =
    baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${origin}/search?propertyCode=${encodeURIComponent(propertyCode)}`;
}

export function buildPropertyR2Key(
  propertyId: string,
  category: string,
  filename: string,
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `properties/${propertyId}/${category}/${Date.now()}-${sanitized}`;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => {
    const str = val == null ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}
