import Link from "next/link";
import { notFound } from "next/navigation";
import { ParcelTabs } from "@/components/parcels/parcel-tabs";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { getParcelDetail } from "@/lib/parcels/queries";

export default async function ParcelOverviewPage({
  params,
  basePath = "/dashboard/parcels",
}: {
  params: Promise<{ id: string }>;
  basePath?: string;
}) {
  const { id } = await params;
  const data = await getParcelDetail(id);
  if (!data) notFound();

  const { parcel, khatians } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Plot {parcel.plotNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {parcel.mouzaName} · JL {parcel.jlNumber} · {parcel.unionName},{" "}
            {parcel.upazilaName}, {parcel.districtName}
          </p>
        </div>
        <StatusBadge
          label={parcel.status ?? "active"}
          variant={statusVariant(parcel.status ?? "active")}
        />
      </div>

      <ParcelTabs parcelId={id} active="" basePath={basePath} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">Area</p>
          <p className="mt-1 text-lg font-medium">
            {parcel.areaValue} {parcel.areaUnit}
          </p>
        </div>
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">Khatians</p>
          <p className="mt-1 text-lg font-medium">{khatians.length}</p>
        </div>
        <div className="rounded-lg border border-sky-200 p-4">
          <p className="text-xs uppercase text-slate-500">Owners</p>
          <p className="mt-1 text-lg font-medium">{data.ownership.length}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Khatian records
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Number</th>
              </tr>
            </thead>
            <tbody>
              {khatians.map((k) => (
                <tr key={k.id} className="border-t border-sky-100">
                  <td className="px-4 py-3">{k.khatianType}</td>
                  <td className="px-4 py-3">{k.khatianNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link
        href={`${basePath}/${id}/ownership`}
        className="text-sm font-medium text-teal-700 hover:underline"
      >
        View ownership details →
      </Link>
    </div>
  );
}
