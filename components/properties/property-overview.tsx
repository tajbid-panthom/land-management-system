import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import {
  GisPropertyInfoPanel,
  ViewOnMapButton,
} from "@/components/properties/gis-property-sync";
import { getPropertyDetail } from "@/lib/properties/queries";
import { getPropertyGisSnapshot } from "@/lib/properties/gis-sync";

export default async function PropertyOverview({
  id,
  basePath = "/dashboard/properties",
  isOwner = false,
}: {
  id: string;
  basePath?: string;
  isOwner?: boolean;
}) {
  const [data, snapshot] = await Promise.all([
    getPropertyDetail(id),
    getPropertyGisSnapshot(id),
  ]);
  if (!data) notFound();

  const { property, khatians, ownership } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            {property.propertyCode}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Plot {snapshot?.plotNumber ?? property.plotNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {snapshot?.mouza ?? property.mouzaName} · JL{" "}
            {snapshot?.jlNumber ?? property.jlNumber} ·{" "}
            {snapshot?.upazila ?? property.upazilaName},{" "}
            {snapshot?.district ?? property.districtName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewOnMapButton href={snapshot?.mapHref} />
          <StatusBadge
            label={property.status ?? "active"}
            variant={statusVariant(property.status ?? "active")}
          />
        </div>
      </div>

      <PropertyTabs
        propertyId={id}
        active=""
        basePath={basePath}
        isOwner={isOwner}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">Area</p>
          <p className="mt-1 text-lg font-medium">
            {snapshot?.area
              ? `${snapshot.area}${snapshot.areaUnit ? ` ${snapshot.areaUnit}` : ""}`
              : (property.areaDecimal ?? "—")}
          </p>
        </div>
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">Khatians</p>
          <p className="mt-1 text-lg font-medium">{khatians.length}</p>
        </div>
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">Owners</p>
          <p className="mt-1 text-lg font-medium">{ownership.length}</p>
        </div>
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">GIS Status</p>
          <p className="mt-1 text-lg font-medium capitalize">
            {snapshot?.syncStatus?.replace(/_/g, " ") ?? "—"}
          </p>
        </div>
      </div>

      {snapshot ? <GisPropertyInfoPanel snapshot={snapshot} /> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-sky-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Property Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Created</dt>
              <dd>{property.createdAt?.toLocaleDateString() ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last updated</dt>
              <dd>{property.updatedAt?.toLocaleDateString() ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Parcel ID</dt>
              <dd className="font-mono text-xs">{property.parcelId}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-sky-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Khatian Numbers</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-slate-500">CS</dt>
              <dd>{property.khatianCs ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">SA</dt>
              <dd>{property.khatianSa ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">RS</dt>
              <dd>{property.khatianRs ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">BS</dt>
              <dd>{property.khatianBs ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
