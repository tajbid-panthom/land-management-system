import type { Geometry } from "geojson";

export type PopupRow = {
  label: string;
  value: string | null | undefined;
};

export type PopupSection = {
  title: string;
  rows: PopupRow[];
};

export type PropertyDocumentRef = {
  id: string;
  fileName: string;
  mimeType: string;
} | null;

export type MouzaPopupDetail = {
  id?: string;
  plotNo?: string | null;
  mauza?: string;
  jlNo?: string;
  mCode?: string | null;
  sheetNo?: string | null;
  revenueNo?: string | null;
  project?: string | null;
  mDistrict?: string | null;
  mUpazila?: string | null;
  unionName?: string | null;
  landType?: string | null;
  landClass?: string | null;
  mAcres?: string | null;
  khasArea?: string | null;
  shapeLeng?: string | null;
  shapeArea?: string | null;
  boundaryLength?: string | null;
  scale?: string | null;
  prepDate?: string | null;
  syncStatus?: string | null;
  syncMessage?: string | null;
  featureId?: string | null;
  parcelId?: string | null;
  propertyId?: string | null;
  propertyCode?: string | null;
  geometry?: Geometry | null;
  coordinates?: string | null;
  khatianNumbers?: string | null;
  currentOwners?: string | null;
  ownershipStatus?: string | null;
  ownerCount?: number | null;
  registeredDeedNumber?: string | null;
  registrationDate?: string | null;
  mutationStatus?: string | null;
  courtCaseStatus?: string | null;
  registrationDeed?: PropertyDocumentRef;
  mutationCertificate?: PropertyDocumentRef;
};

function compactRows(rows: PopupRow[]): PopupRow[] {
  return rows.filter((row) => row.value != null && String(row.value).trim() !== "");
}

function formatArea(value: string | null | undefined, unit?: string | null) {
  if (!value) return null;
  return unit ? `${value} ${unit}` : value;
}

export function buildMouzaPopupSections(
  detail: MouzaPopupDetail,
  options?: { includeSensitive?: boolean },
): PopupSection[] {
  const includeSensitive = options?.includeSensitive !== false;
  const sections: PopupSection[] = [
    {
      title: "Property Information",
      rows: compactRows([
        { label: "Property Code", value: detail.propertyCode },
        { label: "Plot (Dag) Number", value: detail.plotNo },
        {
          label: "Khatian Number",
          value: includeSensitive ? detail.khatianNumbers : null,
        },
        { label: "Mouza", value: detail.mauza },
        { label: "JL Number", value: detail.jlNo },
        { label: "District", value: detail.mDistrict },
        { label: "Upazila / Thana", value: detail.mUpazila },
        { label: "Union", value: detail.unionName },
        { label: "Land Type", value: detail.landType },
        { label: "Land Class", value: detail.landClass },
        { label: "Area", value: formatArea(detail.mAcres, "acres") },
        { label: "Khas Area", value: detail.khasArea },
        {
          label: "Boundary Length",
          value: detail.boundaryLength ?? detail.shapeLeng,
        },
        { label: "Revenue Number", value: detail.revenueNo },
        { label: "Project", value: detail.project },
        { label: "Sheet Number", value: detail.sheetNo },
        { label: "Mouza Code", value: detail.mCode },
        { label: "Scale", value: detail.scale },
        { label: "Preparation Date", value: detail.prepDate },
      ]),
    },
  ];

  if (includeSensitive) {
    sections.push(
      {
        title: "Ownership Information",
        rows: compactRows([
          { label: "Current Owner(s)", value: detail.currentOwners },
          { label: "Ownership Status", value: detail.ownershipStatus },
          {
            label: "Number of Owners",
            value:
              detail.ownerCount != null && detail.ownerCount > 0
                ? String(detail.ownerCount)
                : null,
          },
        ]),
      },
      {
        title: "Registration Information",
        rows: compactRows([
          {
            label: "Registered Deed Number",
            value: detail.registeredDeedNumber,
          },
          { label: "Registration Date", value: detail.registrationDate },
          { label: "Mutation Status", value: detail.mutationStatus },
          { label: "Court Case Status", value: detail.courtCaseStatus },
        ]),
      },
    );
  }

  sections.push({
    title: "GIS Information",
    rows: compactRows([
      { label: "Geometry Type", value: detail.geometry?.type },
      { label: "Coordinates", value: detail.coordinates },
      { label: "Feature ID", value: detail.featureId ?? detail.id },
      { label: "Sync Status", value: detail.syncStatus },
    ]),
  });

  return sections.filter((section) => section.rows.length > 0);
}

export type PropertyDocumentAction = {
  kind: "registration_deed" | "mutation_certificate";
  label: string;
  available: boolean;
  documentId?: string;
  fileName?: string;
  propertyId?: string | null;
  /** When PDF is missing, deep-link to upload on the property documents page. */
  uploadHref?: string | null;
  hint?: string | null;
};

export function buildPropertyDocumentActions(
  detail: MouzaPopupDetail,
): PropertyDocumentAction[] {
  const docsHref = detail.propertyId
    ? `/dashboard/properties/${detail.propertyId}/documents`
    : null;

  return [
    {
      kind: "registration_deed",
      label: "Registration Deed",
      available: Boolean(detail.registrationDeed?.id && detail.propertyId),
      documentId: detail.registrationDeed?.id,
      fileName: detail.registrationDeed?.fileName,
      propertyId: detail.propertyId,
      uploadHref: docsHref,
      hint: detail.propertyId
        ? detail.registrationDeed
          ? null
          : "No PDF uploaded yet — upload on the property documents page"
        : "Create or link a property first to attach documents",
    },
    {
      kind: "mutation_certificate",
      label: "Mutation Certificate",
      available: Boolean(detail.mutationCertificate?.id && detail.propertyId),
      documentId: detail.mutationCertificate?.id,
      fileName: detail.mutationCertificate?.fileName,
      propertyId: detail.propertyId,
      uploadHref: docsHref,
      hint: detail.propertyId
        ? detail.mutationCertificate
          ? null
          : "No PDF uploaded yet — upload on the property documents page"
        : "Create or link a property first to attach documents",
    },
  ];
}

export function buildGisLayerPopupSections(input: {
  layerName: string;
  geometryType: string;
  properties: Record<string, unknown>;
  featureId?: string | null;
  coordinates?: string | null;
}): PopupSection[] {
  const attributeRows = Object.entries(input.properties)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      label: key.replace(/_/g, " "),
      value: String(value),
    }));

  return [
    {
      title: "GIS Information",
      rows: compactRows([
        { label: "Layer", value: input.layerName },
        { label: "Geometry Type", value: input.geometryType },
        { label: "Coordinates", value: input.coordinates },
        { label: "Feature ID", value: input.featureId },
      ]),
    },
    ...(attributeRows.length > 0
      ? [{ title: "Attributes", rows: attributeRows }]
      : []),
  ];
}

export function getGeometryAnchor(geometry: Geometry | null | undefined): {
  lng: number;
  lat: number;
} | null {
  if (!geometry) return null;

  const visit = (coords: unknown): [number, number] | null => {
    if (!Array.isArray(coords)) return null;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      return coords as [number, number];
    }
    for (const child of coords) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };

  const first = "coordinates" in geometry ? visit(geometry.coordinates) : null;
  if (!first) return null;
  return { lng: first[0], lat: first[1] };
}

export function formatCoordinates(lng: number, lat: number): string {
  return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
}
