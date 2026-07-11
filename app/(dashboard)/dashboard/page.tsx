import Link from "next/link";
import { count, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  properties,
  propertyDocuments,
  owners,
  propertyDeeds,
  auditLogs,
} from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";

export default async function AdminDashboardPage() {
  const [[propCount], [ownerCount], [deedCount], [docCount], [auditCount]] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(properties)
        .where(isNull(properties.deletedAt)),
      db
        .select({ count: count() })
        .from(owners)
        .where(isNull(owners.deletedAt)),
      db.select({ count: count() }).from(propertyDeeds),
      db
        .select({ count: count() })
        .from(propertyDocuments)
        .where(isNull(propertyDocuments.deletedAt)),
      db.select({ count: count() }).from(auditLogs),
    ]);

  const stats = [
    { label: "Properties", value: propCount?.count ?? 0, href: "/dashboard/properties" },
    { label: "Owners", value: ownerCount?.count ?? 0, href: "/dashboard/owners" },
    { label: "Registered Deeds", value: deedCount?.count ?? 0, href: "/dashboard/deeds" },
    { label: "Documents", value: docCount?.count ?? 0, href: "/dashboard/documents" },
    { label: "Audit Logs", value: auditCount?.count ?? 0, href: "/dashboard/audit-logs" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Land Management System — Property Administration"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border border-sky-200 p-6 transition hover:border-teal-300 hover:shadow-sm"
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
