import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { propertyDeeds, properties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function DeedsAdminPage() {
  const rows = await db
    .select({
      id: propertyDeeds.id,
      deedNumber: propertyDeeds.deedNumber,
      registrationDate: propertyDeeds.registrationDate,
      namjariStatus: propertyDeeds.namjariStatus,
      propertyId: properties.id,
      propertyCode: properties.propertyCode,
    })
    .from(propertyDeeds)
    .innerJoin(properties, eq(propertyDeeds.propertyId, properties.id))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Registered Deeds"
        description="All registered deed records across properties"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Registered Deeds" },
        ]}
      />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Deed Number</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Registration Date</th>
              <th className="px-4 py-3">Namjari</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-sky-100">
                <td className="px-4 py-3">{d.deedNumber}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/properties/${d.propertyId}/deed`}
                    className="text-teal-700 hover:underline"
                  >
                    {d.propertyCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{d.registrationDate}</td>
                <td className="px-4 py-3">{d.namjariStatus ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
