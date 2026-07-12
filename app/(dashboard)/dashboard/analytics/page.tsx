import { PageHeader } from "@/components/ui/page-header";
import { getGisAnalyticsBreakdown } from "@/lib/properties/gis-sync";

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; count: number }>;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <section className="rounded-lg border border-sky-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={`${title}-${row.name}`}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate text-slate-700">{row.name}</span>
                <span className="font-medium tabular-nums text-slate-900">
                  {row.count}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded bg-teal-600"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AnalyticsPage() {
  const data = await getGisAnalyticsBreakdown();

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="GIS-synchronized property analytics by geography, land attributes, and status"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="By Division" rows={data.byDivision} />
        <BreakdownCard title="By District" rows={data.byDistrict} />
        <BreakdownCard title="By Upazila / Thana" rows={data.byUpazila} />
        <BreakdownCard title="By Mouza" rows={data.byMouza} />
        <BreakdownCard title="By Land Type (GIS)" rows={data.byLandType} />
        <BreakdownCard title="By Land Class (GIS)" rows={data.byLandClass} />
        <BreakdownCard title="By Property Status" rows={data.byPropertyStatus} />
        <BreakdownCard title="By GIS Sync Status" rows={data.bySyncStatus} />
      </div>
    </div>
  );
}
