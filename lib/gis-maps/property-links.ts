import type { MouzaPopupDetail } from "@/lib/gis-maps/feature-popup";
import { extractGisMatchKeys } from "@/lib/gis-maps/gis-attributes";

export type PropertyPopupLink = {
  href: string;
  label: string;
  variant: "primary" | "secondary";
};

export function buildPropertyCreateHref(input: {
  plotNo?: string | null;
  mauza?: string | null;
  jlNo?: string | null;
  district?: string | null;
  upazila?: string | null;
  mCode?: string | null;
  mAcres?: string | null;
  shapeArea?: string | null;
  khasArea?: string | null;
  revenueNo?: string | null;
  landType?: string | null;
  featureId?: string | null;
  mapId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.district) params.set("district", input.district);
  if (input.upazila) params.set("upazila", input.upazila);
  if (input.mauza) params.set("mouza", input.mauza);
  if (input.plotNo) params.set("plotNo", input.plotNo);
  if (input.jlNo) params.set("jlNo", input.jlNo);
  if (input.mCode) params.set("mCode", input.mCode);
  if (input.mAcres) {
    params.set("areaValue", input.mAcres);
    params.set("areaUnit", "acre");
  } else if (input.shapeArea) {
    // Fallback so create form is not left with an empty required area.
    params.set("areaValue", input.shapeArea);
    params.set("areaUnit", "acre");
  }
  if (input.revenueNo) params.set("revenueNo", input.revenueNo);
  if (input.landType) params.set("landType", input.landType);
  if (input.featureId) params.set("featureId", input.featureId);
  if (input.mapId) params.set("mapId", input.mapId);
  params.set("fromGis", "1");
  const qs = params.toString();
  return qs
    ? `/dashboard/properties/new?${qs}`
    : "/dashboard/properties/new";
}

export function buildPropertyCreateHrefFromDetail(
  detail: MouzaPopupDetail,
  extras?: { mapId?: string | null },
): string {
  return buildPropertyCreateHref({
    plotNo: detail.plotNo,
    mauza: detail.mauza,
    jlNo: detail.jlNo,
    district: detail.mDistrict,
    upazila: detail.mUpazila,
    mCode: detail.mCode,
    mAcres: detail.mAcres ?? detail.khasArea,
    shapeArea: detail.shapeArea,
    khasArea: detail.khasArea,
    revenueNo: detail.revenueNo,
    landType: detail.landType,
    featureId: detail.featureId ?? detail.id,
    mapId: extras?.mapId,
  });
}

export function buildPropertyCreateHrefFromGisProperties(
  properties: Record<string, unknown>,
  extras?: { featureId?: string | null; mapId?: string | null },
): string {
  const keys = extractGisMatchKeys(properties);
  return buildPropertyCreateHref({
    plotNo: keys.plotNo,
    mauza: keys.mauza,
    jlNo: keys.jlNo,
    district: keys.district,
    upazila: keys.upazila,
    mCode: keys.mCode,
    mAcres: keys.mAcres ?? keys.khasArea,
    shapeArea: keys.shapeArea,
    khasArea: keys.khasArea,
    revenueNo: keys.revenueNo,
    landType: keys.landType,
    featureId: extras?.featureId,
    mapId: extras?.mapId,
  });
}

export function buildPropertyPopupLinks(
  detail: MouzaPopupDetail | null,
  extras?: {
    mapId?: string | null;
    gisProperties?: Record<string, unknown> | null;
    featureId?: string | null;
  },
): PropertyPopupLink[] {
  const links: PropertyPopupLink[] = [];

  if (detail?.propertyId) {
    links.push({
      href: `/dashboard/properties/${detail.propertyId}`,
      label: "Open Property",
      variant: "primary",
    });
    links.push({
      href: `/dashboard/properties/${detail.propertyId}/documents`,
      label:
        detail.registrationDeed || detail.mutationCertificate
          ? "Manage Documents"
          : "Upload Documents",
      variant: "secondary",
    });
    return links;
  }

  if (detail?.plotNo || detail?.mauza) {
    links.push({
      href: buildPropertyCreateHrefFromDetail(detail, {
        mapId: extras?.mapId,
      }),
      label: "Create Property from Plot",
      variant: "primary",
    });
    return links;
  }

  if (extras?.gisProperties) {
    links.push({
      href: buildPropertyCreateHrefFromGisProperties(extras.gisProperties, {
        featureId: extras.featureId,
        mapId: extras.mapId,
      }),
      label: "Create Property from Plot",
      variant: "primary",
    });
  }

  return links;
}
