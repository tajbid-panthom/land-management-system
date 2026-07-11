import { notFound, redirect } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { getPropertyDetail } from "@/lib/properties/queries";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";

export default async function PropertyLandPlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (
    !session?.user ||
    !canPerformPropertyAction(session.user.role, "view_land_planning")
  ) {
    redirect(`/dashboard/properties/${(await params).id}`);
  }

  const { id } = await params;
  const data = await getPropertyDetail(id);
  if (!data) notFound();

  const p = data.planning;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.property.propertyCode}</h1>
        <p className="text-sm text-slate-500">Land Use & Planning (Admin only)</p>
      </div>
      <PropertyTabs propertyId={id} active="land-planning" />
      <div className="rounded-lg border border-sky-200 bg-white p-6">
        <dl className="grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">Existing Land Use</dt>
            <dd className="font-medium">{p?.existingLandUse ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Proposed Land Use</dt>
            <dd className="font-medium">{p?.proposedLandUse ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Zoning Classification</dt>
            <dd className="font-medium">{p?.zoningClassification ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Protected Area</dt>
            <dd className="font-medium">{p?.isProtectedArea ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Wetland Status</dt>
            <dd className="font-medium">{p?.wetlandStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Master Plan</dt>
            <dd className="font-medium">{p?.masterPlanRef ?? "—"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-slate-500">DAP Information</dt>
            <dd className="font-medium">{p?.dapInformation ?? "—"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-slate-500">LAP Information</dt>
            <dd className="font-medium">{p?.lapInformation ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Building Restriction Zone</dt>
            <dd className="font-medium">{p?.buildingRestrictionZone ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
