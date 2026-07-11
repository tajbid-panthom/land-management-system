import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { khatians, landParcels, properties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function KhatianAdminPage() {
  const rows = await db
    .select({
      id: khatians.id,
      khatianType: khatians.khatianType,
      khatianNumber: khatians.khatianNumber,
      plotNumber: landParcels.plotNumber,
      propertyId: properties.id,
      propertyCode: properties.propertyCode,
    })
    .from(khatians)
    .innerJoin(landParcels, eq(khatians.parcelId, landParcels.id))
    .leftJoin(properties, eq(properties.parcelId, landParcels.id))
    .limit(100);

  return (
    <div>
      <PageHeader title="Khatian" description="Khatian records (CS, SA, RS, BS)" />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Plot</th>
              <th className="px-4 py-3">Property</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.id} className="border-t border-sky-100">
                <td className="px-4 py-3">{k.khatianType}</td>
                <td className="px-4 py-3">{k.khatianNumber}</td>
                <td className="px-4 py-3">{k.plotNumber}</td>
                <td className="px-4 py-3">
                  {k.propertyId ? (
                    <Link
                      href={`/dashboard/properties/${k.propertyId}`}
                      className="text-teal-700 hover:underline"
                    >
                      {k.propertyCode}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
