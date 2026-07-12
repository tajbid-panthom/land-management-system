import { notFound } from "next/navigation";
import Link from "next/link";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { PropertyDocumentsManager } from "@/components/properties/document-upload-form";
import {
  getPropertyDetail,
  userOwnsProperty,
  userOwnsVerifiedProperty,
} from "@/lib/properties/queries";
import { getPropertyLocationCompleteness } from "@/lib/properties/document-requirements";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { isPropertyOwner } from "@/lib/auth/rbac";
import { canViewDocumentAudit } from "@/lib/properties/document-auth";

export default async function PropertyDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const data = await getPropertyDetail(id);
  if (!data) notFound();

  if (
    session?.user &&
    isPropertyOwner(session.user.role) &&
    !(await userOwnsProperty(session.user.id, id))
  ) {
    notFound();
  }

  const completeness = await getPropertyLocationCompleteness(id);

  let canUpload = false;
  if (session?.user && canPerformPropertyAction(session.user.role, "upload_documents")) {
    if (isPropertyOwner(session.user.role)) {
      canUpload = await userOwnsVerifiedProperty(session.user.id, id);
    } else {
      canUpload = true;
    }
  }

  const showAudit =
    session?.user != null && canViewDocumentAudit(session.user.role);

  const mapHref = `/dashboard/maps/viewer?mouzaId=${encodeURIComponent(
    data.property.mouzaId ?? "",
  )}&plotNo=${encodeURIComponent(data.property.plotNumber ?? "")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{data.property.propertyCode}</h1>
          <p className="text-sm text-slate-500">Property Documents</p>
          {session?.user && isPropertyOwner(session.user.role) && !canUpload ? (
            <p className="mt-2 text-sm text-amber-700">
              Document upload requires verified ownership of this property.
            </p>
          ) : null}
        </div>
        {data.property.mouzaId && data.property.plotNumber ? (
          <Link
            href={mapHref}
            className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-teal-700 hover:bg-sky-50"
          >
            Open on GIS Map
          </Link>
        ) : null}
      </div>
      <PropertyTabs propertyId={id} active="documents" />

      <PropertyDocumentsManager
        propertyId={id}
        documents={data.documents}
        canUpload={canUpload}
        canViewAudit={showAudit}
        locationComplete={completeness.complete}
        missingFields={completeness.missing}
        initialOwner={
          data.ownership[0]
            ? {
                fullName: data.ownership[0].ownerName ?? "",
                fatherOrHusbandName:
                  data.ownership[0].fatherOrHusbandName ?? "",
                motherName: data.ownership[0].motherName ?? "",
                phone: data.ownership[0].phone ?? "",
                email: data.ownership[0].email ?? "",
                dateOfBirth: data.ownership[0].dateOfBirth
                  ? String(data.ownership[0].dateOfBirth)
                  : "",
                sharePercentage: data.ownership[0].sharePercentage
                  ? String(data.ownership[0].sharePercentage)
                  : "100",
              }
            : null
        }
      />
    </div>
  );
}
