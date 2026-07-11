import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { getPropertyDetail } from "@/lib/properties/queries";

const REPORT_TYPES = [
  "Khatian Copy",
  "Mouza Map",
  "Plot Map",
  "Registered Deed Copy",
  "Mutation Certificate",
  "Survey Records",
  "GIS Map",
  "Property Information Report",
];

export default async function PropertyReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPropertyDetail(id);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.property.propertyCode}</h1>
        <p className="text-sm text-slate-500">Reports & Downloads</p>
      </div>
      <PropertyTabs propertyId={id} active="reports" />

      <div className="grid gap-3 md:grid-cols-2">
        {REPORT_TYPES.map((type) => (
          <div
            key={type}
            className="flex items-center justify-between rounded-lg border border-sky-200 p-4"
          >
            <span className="text-sm font-medium">{type}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-sky-200 px-3 py-1 text-xs text-slate-600 hover:bg-sky-50"
              >
                Preview
              </button>
              <button
                type="button"
                className="rounded-md bg-teal-700 px-3 py-1 text-xs text-white hover:bg-teal-800"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {data.reports.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
            Generated Reports
          </h2>
          <ul className="space-y-2 text-sm">
            {data.reports.map((r) => (
              <li key={r.id} className="rounded-md border border-sky-100 p-3">
                {r.reportType} — {r.status}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
