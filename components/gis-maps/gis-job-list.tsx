"use client";

import { statusLabel } from "@/lib/gis-maps/constants";

type JobRow = {
  id: string;
  mapId: string;
  mapName: string | null;
  status: string;
  progress: number;
  message: string | null;
  errorMessage: string | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date | null;
};

export function GisJobList({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-8 text-center text-sm text-slate-500">
        No processing jobs yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-sky-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-sky-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Map</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Message</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3">Completed</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-t border-sky-100">
              <td className="px-4 py-3 font-medium">{job.mapName ?? job.mapId}</td>
              <td className="px-4 py-3">{statusLabel(job.status)}</td>
              <td className="px-4 py-3">{job.progress}%</td>
              <td className="px-4 py-3 text-slate-600">
                {job.errorMessage ?? job.message ?? "—"}
              </td>
              <td className="px-4 py-3">
                {job.startedAt
                  ? new Date(job.startedAt).toLocaleString()
                  : "—"}
              </td>
              <td className="px-4 py-3">
                {job.completedAt
                  ? new Date(job.completedAt).toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
