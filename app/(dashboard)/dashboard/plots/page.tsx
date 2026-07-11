import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { listProperties } from "@/lib/properties/queries";

export default async function PlotsAdminPage() {
  const { items } = await listProperties({
    page: 1,
    limit: 100,
    sortOrder: "desc",
    includeDeleted: false,
  });

  return (
    <div>
      <PageHeader title="Plots" description="Plot / Dag numbers across properties" />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Plot</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Mouza</th>
              <th className="px-4 py-3">Area</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">{p.plotNumber}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/properties/${p.id}`}
                    className="text-teal-700 hover:underline"
                  >
                    {p.propertyCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{p.mouzaName}</td>
                <td className="px-4 py-3">{p.areaDecimal} decimal</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
