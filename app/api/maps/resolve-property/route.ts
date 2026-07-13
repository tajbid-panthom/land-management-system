import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canViewDocumentAudit } from "@/lib/properties/document-auth";
import {
  getGisLayerFeatureCentroid,
  resolvePropertyDetailFromGisAttributes,
} from "@/lib/gis-maps/resolve-property";
import { getFeatureById } from "@/lib/gis-maps/queries";
import {
  formatCoordinates,
  type MouzaPopupDetail,
} from "@/lib/gis-maps/feature-popup";

const bodySchema = z.object({
  properties: z.record(z.string(), z.unknown()),
  featureId: z.string().nullable().optional(),
  coordinates: z.string().nullable().optional(),
  layerName: z.string().nullable().optional(),
});

/** Strip deed/mutation PDFs and registration numbers for non-admin users. */
function redactSensitiveDetail(
  detail: MouzaPopupDetail | null,
  allowDocuments: boolean,
): MouzaPopupDetail | null {
  if (!detail || allowDocuments) return detail;
  return {
    ...detail,
    registeredDeedNumber: null,
    registrationDate: null,
    mutationStatus: null,
    courtCaseStatus: null,
    registrationDeed: null,
    mutationCertificate: null,
    currentOwners: null,
    ownershipStatus: null,
    ownerCount: null,
    khatianNumbers: null,
  };
}

async function sessionAllowsDocuments() {
  const session = await getSession();
  return Boolean(
    session?.user?.id && canViewDocumentAudit(session.user.role),
  );
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "properties object is required" },
      { status: 400 },
    );
  }

  const allowDocuments = await sessionAllowsDocuments();
  const detail = await resolvePropertyDetailFromGisAttributes(parsed.data);
  return NextResponse.json({
    detail: redactSensitiveDetail(detail, allowDocuments),
    authenticated: allowDocuments,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const featureId = url.searchParams.get("featureId");
  if (!featureId) {
    return NextResponse.json(
      { error: "featureId is required" },
      { status: 400 },
    );
  }

  const feature = await getFeatureById(featureId);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  const anchor = await getGisLayerFeatureCentroid(featureId);
  const coordinates = anchor
    ? formatCoordinates(anchor.lng, anchor.lat)
    : null;

  const allowDocuments = await sessionAllowsDocuments();
  const detail = await resolvePropertyDetailFromGisAttributes({
    properties: feature.properties ?? {},
    featureId,
    coordinates,
    layerName: feature.layer_name ?? null,
  });

  return NextResponse.json({
    detail: redactSensitiveDetail(detail, allowDocuments),
    anchor,
    authenticated: allowDocuments,
  });
}
