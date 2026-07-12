"use client";

import { useEffect, useState } from "react";

type AuditItem = {
  id: string;
  actionPerformed: string;
  uploadedByName: string | null;
  uploadedByEmail: string | null;
  userRole: string | null;
  propertyId: string | null;
  plotNumber: string | null;
  mouza: string | null;
  fileName: string | null;
  category: string | null;
  createdAt: string | null;
};

export function DocumentAuditHistory({ propertyId }: { propertyId: string }) {
  const [history, setHistory] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/properties/${propertyId}/documents?audit=1`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Unable to load audit history");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setHistory(data.history ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return (
    <section className="rounded-lg border border-sky-200 bg-white">
      <div className="border-b border-sky-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Document Audit History
        </h3>
        <p className="text-xs text-slate-500">
          Visible to administrators only. Tracks create, update, and delete
          actions.
        </p>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-slate-500">Loading audit history…</p>
      ) : error ? (
        <p className="p-4 text-sm text-red-600">{error}</p>
      ) : history.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No document actions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date / Time</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Uploaded / Updated By</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Plot</th>
                <th className="px-3 py-2">Mouza</th>
                <th className="px-3 py-2">Property ID</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-t border-sky-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {item.actionPerformed}
                  </td>
                  <td className="px-3 py-2">
                    <div>{item.uploadedByName ?? "—"}</div>
                    <div className="text-xs text-slate-500">
                      {item.uploadedByEmail}
                    </div>
                  </td>
                  <td className="px-3 py-2">{item.userRole ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="max-w-[160px] truncate" title={item.fileName ?? ""}>
                      {item.fileName ?? "—"}
                    </div>
                    {item.category ? (
                      <div className="text-xs text-slate-500">{item.category}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{item.plotNumber ?? "—"}</td>
                  <td className="px-3 py-2">{item.mouza ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {item.propertyId?.slice(0, 8) ?? "—"}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
