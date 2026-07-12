import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { propertyDeeds, properties, propertyLocations } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { buildMapViewerHref } from "@/lib/properties/gis-sync";

export default async function DeedsAdminPage() {
  const rows = await db
    .select({
      id: propertyDeeds.id,
      deedNumber: propertyDeeds.deedNumber,
      registrationDate: propertyDeeds.registrationDate,
      namjariStatus: propertyDeeds.namjariStatus,
      propertyId: properties.id,
      propertyCode: properties.propertyCode,
      mouzaId: propertyLocations.mouzaId,
      plotNumber: propertyLocations.plotNumber,
      mouzaName: propertyLocations.mouzaName,
    })
    .from(propertyDeeds)
    .innerJoin(properties, eq(propertyDeeds.propertyId, properties.id))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .where(isNull(properties.deletedAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Registered Deeds"
        description="Deed records synchronized with property GIS locations"
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
              <th className="px-4 py-3">Mouza / Plot</th>
              <th className="px-4 py-3">Registration Date</th>
              <th className="px-4 py-3">Namjari</th>
              <th className="px-4 py-3">Map</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const mapHref = buildMapViewerHref({
                mouzaId: d.mouzaId,
                plotNumber: d.plotNumber,
              });
              return (
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
                  <td className="px-4 py-3">
                    {d.mouzaName ?? "—"}
                    {d.plotNumber ? ` · Plot ${d.plotNumber}` : ""}
                  </td>
                  <td className="px-4 py-3">{d.registrationDate}</td>
                  <td className="px-4 py-3">{d.namjariStatus ?? "—"}</td>
                  <td className="px-4 py-3">
                    {mapHref ? (
                      <Link
                        href={mapHref}
                        className="text-cyan-800 hover:underline"
                      >
                        View on Map
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
