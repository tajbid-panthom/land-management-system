import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { planningInformation, properties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function LandPlanningAdminPage() {
  const rows = await db
    .select({
      propertyId: properties.id,
      propertyCode: properties.propertyCode,
      existingLandUse: planningInformation.existingLandUse,
      proposedLandUse: planningInformation.proposedLandUse,
      zoningClassification: planningInformation.zoningClassification,
      isProtectedArea: planningInformation.isProtectedArea,
    })
    .from(planningInformation)
    .innerJoin(properties, eq(planningInformation.propertyId, properties.id))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Land Planning"
        description="Land use and planning information (admin only)"
      />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Existing Use</th>
              <th className="px-4 py-3">Proposed Use</th>
              <th className="px-4 py-3">Zoning</th>
              <th className="px-4 py-3">Protected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.propertyId} className="border-t border-sky-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/properties/${r.propertyId}/land-planning`}
                    className="text-teal-700 hover:underline"
                  >
                    {r.propertyCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.existingLandUse ?? "—"}</td>
                <td className="px-4 py-3">{r.proposedLandUse ?? "—"}</td>
                <td className="px-4 py-3">{r.zoningClassification ?? "—"}</td>
                <td className="px-4 py-3">{r.isProtectedArea ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
