import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getOwnerPropertyIds } from "@/lib/properties/queries";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { listProperties } from "@/lib/properties/queries";

export default async function OwnerDashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const ownedIds = await getOwnerPropertyIds(session.user.id);
  const { items } = await listProperties({
    page: 1,
    limit: 100,
    sortOrder: "desc",
    includeDeleted: false,
  });
  const myProperties = items.filter((p) => ownedIds.includes(p.id));

  return (
    <div>
      <PageHeader
        title="Owner Dashboard"
        description="View and manage your registered properties"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-sky-200 p-6">
          <p className="text-sm text-slate-500">My Properties</p>
          <p className="mt-2 text-3xl font-semibold">{myProperties.length}</p>
        </div>
      </div>
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Your Properties</h2>
        {myProperties.length === 0 ? (
          <p className="text-sm text-slate-500">No properties linked to your account.</p>
        ) : (
          <ul className="space-y-2">
            {myProperties.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/properties/${p.id}`}
                  className="block rounded-lg border border-sky-200 p-4 hover:border-teal-300"
                >
                  <span className="font-medium text-teal-700">{p.propertyCode}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    Plot {p.plotNumber} · {p.mouzaName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
