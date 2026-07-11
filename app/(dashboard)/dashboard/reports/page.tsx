import { ReportGenerator } from "@/components/reports/report-generator";

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Property Information Report generation pipeline
      </p>
      <div className="mt-6">
        <ReportGenerator />
      </div>
    </div>
  );
}
