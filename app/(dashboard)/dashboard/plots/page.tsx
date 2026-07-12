import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { GisSyncBadge } from "@/components/properties/gis-property-sync";
import { listAdminGisPlots } from "@/lib/properties/gis-sync";

export default async function PlotsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const search = params.search ?? "";
  const { items, total, limit } = await listAdminGisPlots({
    page,
    limit: 50,
    search: search || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Plots"
        description="GIS plot / dag records synchronized from Mouza GIS (with property links when available)"
      />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search plot, mouza, JL, district, property code…"
          className="w-full max-w-md rounded-md border border-sky-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Plot</th>
              <th className="px-4 py-3">Mouza</th>
              <th className="px-4 py-3">JL</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Land Type</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">GIS</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Map</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-sky-100">
                <td className="px-4 py-3 font-medium">{p.plotNumber ?? "—"}</td>
                <td className="px-4 py-3">{p.mouzaName ?? "—"}</td>
                <td className="px-4 py-3">{p.jlNumber ?? "—"}</td>
                <td className="px-4 py-3">{p.district ?? "—"}</td>
                <td className="px-4 py-3">{p.landType ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.area ? `${p.area} acres` : "—"}
                </td>
                <td className="px-4 py-3">
                  <GisSyncBadge
                    status={p.syncStatus ?? "unlinked"}
                    hasGeometry={p.hasGeometry}
                  />
                </td>
                <td className="px-4 py-3">
                  {p.propertyId ? (
                    <Link
                      href={`/dashboard/properties/${p.propertyId}`}
                      className="text-teal-700 hover:underline"
                    >
                      {p.propertyCode}
                    </Link>
                  ) : (
                    <span className="text-slate-400">Unlinked</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.mapHref ? (
                    <Link
                      href={p.mapHref}
                      className="text-cyan-800 hover:underline"
                    >
                      Zoom to Plot
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <EmptyState
            title="No plots found"
            description="Import and synchronize a Mouza GIS dataset to populate plots."
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <p>
          Showing {items.length} of {total.toLocaleString()} plots (page {page})
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/dashboard/plots?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className="rounded-md border border-sky-200 px-3 py-1.5 text-slate-700 hover:bg-sky-50"
            >
              Previous
            </Link>
          ) : null}
          {page * limit < total ? (
            <Link
              href={`/dashboard/plots?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className="rounded-md border border-sky-200 px-3 py-1.5 text-slate-700 hover:bg-sky-50"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
