import Link from "next/link";
import { count, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { owners, auditLogs } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { getAdminGisDashboardStats } from "@/lib/properties/gis-sync";

export default async function AdminDashboardPage() {
  const [gisStats, [ownerCount], [auditCount]] = await Promise.all([
    getAdminGisDashboardStats(),
    db.select({ count: count() }).from(owners).where(isNull(owners.deletedAt)),
    db.select({ count: count() }).from(auditLogs),
  ]);

  const stats = [
    {
      label: "Total Properties",
      value: gisStats.totalProperties,
      href: "/dashboard/properties",
    },
    {
      label: "Total Districts",
      value: gisStats.totalDistricts,
      href: "/dashboard/analytics",
    },
    {
      label: "Total Upazilas / Thanas",
      value: gisStats.totalUpazilas,
      href: "/dashboard/analytics",
    },
    {
      label: "Total Mouzas",
      value: gisStats.totalMouzas,
      href: "/dashboard/mouza",
    },
    {
      label: "Total Plots",
      value: gisStats.totalPlots,
      href: "/dashboard/plots",
    },
    {
      label: "Properties with GIS Mapping",
      value: gisStats.propertiesWithGis,
      href: "/dashboard/properties",
    },
    {
      label: "Properties without GIS Mapping",
      value: gisStats.propertiesWithoutGis,
      href: "/dashboard/properties",
    },
    {
      label: "With Registration Deeds",
      value: gisStats.propertiesWithRegistrationDeed,
      href: "/dashboard/documents",
    },
    {
      label: "With Mutation Certificates",
      value: gisStats.propertiesWithMutationCertificate,
      href: "/dashboard/documents",
    },
    {
      label: "GIS Synced Records",
      value: gisStats.gisSyncedRecords,
      href: "/dashboard/mouza",
    },
    {
      label: "GIS Geometry Missing",
      value: gisStats.gisGeometryMissing,
      href: "/dashboard/mouza",
    },
    {
      label: "GIS Import Datasets",
      value: gisStats.gisImportDatasets,
      href: "/dashboard/maps",
    },
    {
      label: "Owners",
      value: ownerCount?.count ?? 0,
      href: "/dashboard/owners",
    },
    {
      label: "Audit Logs",
      value: auditCount?.count ?? 0,
      href: "/dashboard/audit-logs",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Synchronized Property + GIS statistics across the Admin Panel"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard/maps/viewer"
          className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Open GIS Viewer
        </Link>
        <Link
          href="/dashboard/analytics"
          className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-sky-50"
        >
          View Analytics
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border border-sky-200 p-5 transition hover:border-teal-300 hover:shadow-sm"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
