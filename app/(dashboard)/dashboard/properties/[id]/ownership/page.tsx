import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { getPropertyDetail } from "@/lib/properties/queries";

export default async function PropertyOwnershipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPropertyDetail(id);
  if (!data) notFound();

  const totalShare = data.ownership
    .filter((o) => o.isCurrent)
    .reduce((sum, o) => sum + Number(o.sharePercentage), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.property.propertyCode}</h1>
        <p className="text-sm text-slate-500">
          Ownership · Total share: {totalShare}%
        </p>
      </div>
      <PropertyTabs propertyId={id} active="ownership" />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
          Current Owner(s)
        </h2>
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Share</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Verification</th>
              </tr>
            </thead>
            <tbody>
              {data.ownership
                .filter((o) => o.isCurrent)
                .map((o) => (
                  <tr key={o.id} className="border-t border-sky-100">
                    <td className="px-4 py-3 font-medium">{o.ownerName}</td>
                    <td className="px-4 py-3">{o.sharePercentage}%</td>
                    <td className="px-4 py-3">{o.phone ?? "—"}</td>
                    <td className="px-4 py-3">{o.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={o.verificationStatus ?? "pending"}
                        variant={statusVariant(o.verificationStatus ?? "pending")}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.coOwners.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
            Co-owners
          </h2>
          <div className="overflow-hidden rounded-lg border border-sky-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-sky-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Relationship</th>
                  <th className="px-4 py-3">Share %</th>
                </tr>
              </thead>
              <tbody>
                {data.coOwners.map((c) => (
                  <tr key={c.id} className="border-t border-sky-100">
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3">{c.relationship ?? "—"}</td>
                    <td className="px-4 py-3">{c.ownershipShare}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.ownershipHistory.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
            Ownership Timeline
          </h2>
          <div className="space-y-3">
            {data.ownershipHistory.map((h) => (
              <div
                key={h.id}
                className="rounded-lg border border-sky-200 p-4 text-sm"
              >
                <p className="font-medium">{h.previousOwnerName}</p>
                <p className="text-slate-500">
                  {h.transferType} · {h.transferDate}
                  {h.saleAmount ? ` · ৳${h.saleAmount}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
