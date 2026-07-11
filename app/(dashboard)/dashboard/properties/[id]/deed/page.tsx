import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { DeedUpdateForm } from "@/components/properties/deed-update-form";
import { getPropertyDetail } from "@/lib/properties/queries";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";

export default async function PropertyDeedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const data = await getPropertyDetail(id);
  if (!data) notFound();

  const canEdit =
    session?.user &&
    canPerformPropertyAction(session.user.role, "update_deed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.property.propertyCode}</h1>
        <p className="text-sm text-slate-500">Registered Deed Information</p>
      </div>
      <PropertyTabs propertyId={id} active="deed" />

      {canEdit ? (
        <DeedUpdateForm propertyId={id} initial={data.deed} />
      ) : (
        <div className="rounded-lg border border-sky-200 bg-white p-6 text-sm">
          {data.deed ? (
            <dl className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-slate-500">Deed Number</dt>
                <dd>{data.deed.deedNumber}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Registration Date</dt>
                <dd>{data.deed.registrationDate}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Mutation Case</dt>
                <dd>{data.deed.mutationCaseNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Namjari Status</dt>
                <dd>{data.deed.namjariStatus ?? "—"}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-slate-500">Litigation Status</dt>
                <dd>{data.deed.litigationStatus ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-slate-500">No deed information recorded.</p>
          )}
        </div>
      )}

      {data.deedVersions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
            Version History
          </h2>
          <div className="overflow-hidden rounded-lg border border-sky-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-sky-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Deed Number</th>
                  <th className="px-4 py-3">Registration Date</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.deedVersions.map((v) => (
                  <tr key={v.property_deed_versions.id} className="border-t border-sky-100">
                    <td className="px-4 py-3">v{v.property_deed_versions.version}</td>
                    <td className="px-4 py-3">{v.property_deed_versions.deedNumber}</td>
                    <td className="px-4 py-3">{v.property_deed_versions.registrationDate}</td>
                    <td className="px-4 py-3">
                      {v.property_deed_versions.createdAt?.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
