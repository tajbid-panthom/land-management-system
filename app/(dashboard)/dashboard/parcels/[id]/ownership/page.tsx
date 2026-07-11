import { notFound } from "next/navigation";
import { ParcelTabs } from "@/components/parcels/parcel-tabs";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { getParcelDetail } from "@/lib/parcels/queries";

export default async function OwnershipPage({
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
        <p className="text-sm text-slate-500">Ownership</p>
      </div>
      <ParcelTabs parcelId={id} active="ownership" />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Share</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Verification</th>
            </tr>
          </thead>
          <tbody>
            {data.ownership.map((o) => (
              <tr key={o.id} className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">{o.ownerName}</td>
                <td className="px-4 py-3">{o.sharePercentage}%</td>
                <td className="px-4 py-3">{o.effectiveFrom}</td>
                <td className="px-4 py-3">{o.acquisitionMethod ?? "—"}</td>
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
    </div>
  );
}
