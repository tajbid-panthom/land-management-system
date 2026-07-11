import { notFound } from "next/navigation";
import { ParcelTabs } from "@/components/parcels/parcel-tabs";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { getParcelDetail } from "@/lib/parcels/queries";

export default async function LegalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getParcelDetail(id);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plot {data.parcel.plotNumber}</h1>
        <p className="text-sm text-slate-500">Legal documents & cases</p>
      </div>
      <ParcelTabs parcelId={id} active="legal" />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          Deeds
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Registration date</th>
              </tr>
            </thead>
            <tbody>
              {data.deeds.map((d) => (
                <tr key={d.id} className="border-t border-sky-100">
                  <td className="px-4 py-3">{d.deedNumber}</td>
                  <td className="px-4 py-3">{d.deedType ?? "—"}</td>
                  <td className="px-4 py-3">{d.registrationDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.deeds.length === 0 && (
            <p className="p-4 text-sm text-slate-500">No deeds recorded.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          Mutation cases
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Applied</th>
              </tr>
            </thead>
            <tbody>
              {data.mutations.map((m) => (
                <tr key={m.id} className="border-t border-sky-100">
                  <td className="px-4 py-3">{m.caseNumber}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={m.status ?? "not_applied"}
                      variant={statusVariant(m.status ?? "not_applied")}
                    />
                  </td>
                  <td className="px-4 py-3">{m.appliedDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          Court cases
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Court</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.courtCases.map((c) => (
                <tr key={c.id} className="border-t border-sky-100">
                  <td className="px-4 py-3">{c.caseNumber}</td>
                  <td className="px-4 py-3">{c.courtName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={c.status ?? "ongoing"}
                      variant={statusVariant(c.status ?? "ongoing")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
