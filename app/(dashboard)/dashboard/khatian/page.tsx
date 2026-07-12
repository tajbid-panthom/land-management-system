import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { listAdminKhatians } from "@/lib/properties/gis-sync";

export default async function KhatianAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const search = params.search ?? "";
  const { items, total, limit } = await listAdminKhatians({
    page,
    limit: 100,
    search: search || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Khatian"
        description="Khatian records from parcels and property profiles, linked to GIS plots"
      />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search khatian, plot, mouza, property…"
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
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Plot</th>
              <th className="px-4 py-3">Mouza</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Map</th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.id} className="border-t border-sky-100">
                <td className="px-4 py-3">{k.khatianType}</td>
                <td className="px-4 py-3 font-medium">{k.khatianNumber}</td>
                <td className="px-4 py-3">{k.plotNumber ?? "—"}</td>
                <td className="px-4 py-3">{k.mouzaName ?? "—"}</td>
                <td className="px-4 py-3 capitalize text-slate-500">
                  {k.source}
                </td>
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
                <td className="px-4 py-3">
                  {k.mapHref ? (
                    <Link
                      href={k.mapHref}
                      className="text-cyan-800 hover:underline"
                    >
                      View on Map
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
            title="No khatian records found"
            description="Add khatian numbers on a property profile, or create parcel khatian records."
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <p>
          Showing {items.length} of {total.toLocaleString()} khatians (page{" "}
          {page})
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/dashboard/khatian?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className="rounded-md border border-sky-200 px-3 py-1.5 text-slate-700 hover:bg-sky-50"
            >
              Previous
            </Link>
          ) : null}
          {page * limit < total ? (
            <Link
              href={`/dashboard/khatian?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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
