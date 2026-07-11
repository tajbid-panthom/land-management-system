import { notFound } from "next/navigation";
import { ParcelTabs } from "@/components/parcels/parcel-tabs";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { getParcelDetail } from "@/lib/parcels/queries";

export default async function ServicesPage({
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
        <p className="text-sm text-slate-500">Additional services</p>
      </div>
      <ParcelTabs parcelId={id} active="services" />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          Mortgages
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.mortgages.map((m) => (
                <tr key={m.id} className="border-t border-sky-100">
                  <td className="px-4 py-3">{m.bankName}</td>
                  <td className="px-4 py-3">{m.chargeAmount ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={m.status ?? "active"}
                      variant={statusVariant(m.status ?? "active")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          Land acquisition
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Authority</th>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.acquisitions.map((a) => (
                <tr key={a.id} className="border-t border-sky-100">
                  <td className="px-4 py-3">{a.acquiringAuthority ?? "—"}</td>
                  <td className="px-4 py-3">{a.caseNumber ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={a.status ?? "none"}
                      variant={statusVariant(a.status ?? "none")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          Transactions
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id} className="border-t border-sky-100">
                  <td className="px-4 py-3">{t.transactionType ?? "—"}</td>
                  <td className="px-4 py-3">{t.transactionDate}</td>
                  <td className="px-4 py-3">{t.amount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
