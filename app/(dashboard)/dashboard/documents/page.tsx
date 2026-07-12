import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import {
  propertyDocuments,
  properties,
  documentCategories,
  propertyLocations,
} from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { buildMapViewerHref } from "@/lib/properties/gis-sync";

export default async function DocumentsAdminPage() {
  const rows = await db
    .select({
      id: propertyDocuments.id,
      fileName: propertyDocuments.fileName,
      categoryName: documentCategories.name,
      version: propertyDocuments.version,
      propertyId: properties.id,
      propertyCode: properties.propertyCode,
      createdAt: propertyDocuments.createdAt,
      mouzaId: propertyLocations.mouzaId,
      plotNumber: propertyLocations.plotNumber,
    })
    .from(propertyDocuments)
    .innerJoin(properties, eq(propertyDocuments.propertyId, properties.id))
    .leftJoin(
      documentCategories,
      eq(propertyDocuments.categoryId, documentCategories.id),
    )
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .where(isNull(propertyDocuments.deletedAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Property documents synchronized with GIS plots"
      />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Uploaded</th>
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
                  <td className="px-4 py-3">{d.fileName}</td>
                  <td className="px-4 py-3">{d.categoryName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/properties/${d.propertyId}/documents`}
                      className="text-teal-700 hover:underline"
                    >
                      {d.propertyCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">v{d.version}</td>
                  <td className="px-4 py-3">
                    {d.createdAt?.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {mapHref ? (
                      <Link
                        href={mapHref}
                        className="text-cyan-800 hover:underline"
                      >
                        Open on Map
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
