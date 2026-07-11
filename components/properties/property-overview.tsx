import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { getPropertyDetail } from "@/lib/properties/queries";

export default async function PropertyOverview({
  id,
  basePath = "/dashboard/properties",
  isOwner = false,
}: {
  id: string;
  basePath?: string;
  isOwner?: boolean;
}) {
  const data = await getPropertyDetail(id);
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
            Plot {property.plotNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {property.mouzaName} · JL {property.jlNumber} · {property.unionName},{" "}
            {property.upazilaName}, {property.districtName}
          </p>
        </div>
        <StatusBadge
          label={property.status ?? "active"}
          variant={statusVariant(property.status ?? "active")}
        />
      </div>

      <PropertyTabs
        propertyId={id}
        active=""
        basePath={basePath}
        isOwner={isOwner}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">Area (decimal)</p>
          <p className="mt-1 text-lg font-medium">{property.areaDecimal ?? "—"}</p>
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
          <p className="text-xs uppercase text-slate-500">QR Code</p>
          <p className="mt-1 truncate text-xs text-slate-600">
            {property.qrCodePayload ?? "—"}
          </p>
        </div>
      </div>

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
