import Link from "next/link";
import { listParcels } from "@/lib/parcels/queries";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";

export default async function ParcelsListPage() {
  const parcels = await listParcels();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Parcels</h1>
          <p className="text-sm text-slate-500">
            Manage land parcels across mouzas
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Plot</th>
              <th className="px-4 py-3">Mouza</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((p) => (
              <tr key={p.id} className="border-t border-sky-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/parcels/${p.id}`}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {p.plotNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{p.mouzaName}</td>
                <td className="px-4 py-3">{p.districtName}</td>
                <td className="px-4 py-3">
                  {p.areaValue} {p.areaUnit}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={p.status ?? "active"}
                    variant={statusVariant(p.status ?? "active")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {parcels.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">
            No parcels yet. Run{" "}
            <code className="rounded bg-sky-100 px-1">pnpm db:seed</code> to
            load sample data.
          </p>
        )}
      </div>
    </div>
  );
}
