import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { getParcelDetail } from "@/lib/parcels/queries";

export default async function PublicParcelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getParcelDetail(id);
  if (!data) notFound();

  const { parcel, khatians, ownership } = data;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl flex-1 bg-white px-4 py-10">
        <div className="rounded-xl border border-sky-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Plot {parcel.plotNumber}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {parcel.mouzaName} · {parcel.districtName}
              </p>
            </div>
            <StatusBadge
              label={parcel.status ?? "active"}
              variant={statusVariant(parcel.status ?? "active")}
            />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Area</p>
              <p className="font-medium">
                {parcel.areaValue} {parcel.areaUnit}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">JL Number</p>
              <p className="font-medium">{parcel.jlNumber}</p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase text-slate-500">
              Khatians
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {khatians.map((k) => (
                <li key={k.id}>
                  {k.khatianType}: {k.khatianNumber}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase text-slate-500">
              Current owners (public summary)
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {ownership
                .filter((o) => o.isCurrent)
                .map((o) => (
                  <li key={o.id}>
                    {o.ownerName} — {o.sharePercentage}%
                  </li>
                ))}
            </ul>
          </section>

          <p className="mt-8 text-xs text-slate-400">
            Public read-only view. Sensitive documents and NID data are not
            shown.
          </p>
        </div>
      </main>
    </>
  );
}
