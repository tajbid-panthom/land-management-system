import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { PropertySearchFilters } from "@/components/properties/property-search-filters";
import { listProperties } from "@/lib/properties/queries";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { getOwnerPropertyIds } from "@/lib/properties/queries";
import { isPropertyOwner } from "@/lib/auth/rbac";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const filters = {
    page: Number(params.page ?? 1),
    limit: Number(params.limit ?? 20),
    sortOrder: (params.sortOrder as "asc" | "desc") ?? "desc",
    sortBy: params.sortBy,
    includeDeleted: params.includeDeleted === "true",
    search: params.search,
    status: params.status as "active" | "pending" | "disputed" | "archived" | undefined,
    plotNumber: params.plotNumber,
    divisionId: params.divisionId,
    districtId: params.districtId,
    upazilaId: params.upazilaId,
    unionId: params.unionId,
    mouzaId: params.mouzaId,
    mouzaName: params.mouzaName,
    jlNumber: params.jlNumber,
    khatianNumber: params.khatianNumber,
    ownerName: params.ownerName,
    ownerNid: params.ownerNid,
    deedNumber: params.deedNumber,
    mutationStatus: params.mutationStatus,
    landUse: params.landUse,
    verificationStatus: params.verificationStatus,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    areaMin: params.areaMin ? Number(params.areaMin) : undefined,
    areaMax: params.areaMax ? Number(params.areaMax) : undefined,
  };

  let { items, total, page, limit } = await listProperties(filters);

  if (session?.user && isPropertyOwner(session.user.role)) {
    const ownedIds = await getOwnerPropertyIds(session.user.id);
    items = items.filter((item) => ownedIds.includes(item.id));
    total = items.length;
  }

  const canCreate =
    session?.user &&
    canPerformPropertyAction(session.user.role, "create");

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Manage land properties with mouza, deed, and ownership records"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Properties" },
        ]}
        actions={
          canCreate ? (
            <Link
              href="/dashboard/properties/new"
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Create Property
            </Link>
          ) : undefined
        }
      />

      <Suspense fallback={null}>
        <PropertySearchFilters />
      </Suspense>

      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Property ID</th>
              <th className="px-4 py-3">Plot</th>
              <th className="px-4 py-3">Mouza</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-sky-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/properties/${p.id}`}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {p.propertyCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{p.plotNumber}</td>
                <td className="px-4 py-3">{p.mouzaName}</td>
                <td className="px-4 py-3">{p.districtName}</td>
                <td className="px-4 py-3">{p.areaDecimal} decimal</td>
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
        {items.length === 0 && (
          <EmptyState
            title="No properties found"
            description="Create a property or adjust your filters."
          />
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Showing {items.length} of {total} properties (page {page})
      </p>
    </div>
  );
}
