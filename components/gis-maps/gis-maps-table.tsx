"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusLabel } from "@/lib/gis-maps/constants";

export type GisMapRow = {
  id: string;
  name: string;
  status: string;
  fileFormat: string | null;
  fileSizeBytes: number | null;
  originalFileName: string;
  uploaderName: string | null;
  layerCount: number;
  createdAt: string | Date | null;
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GisMapsTable({ maps }: { maps: GisMapRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const runAction = async (id: string, action: "delete" | "reprocess") => {
    setBusyId(id);
    try {
      const endpoint =
        action === "delete"
          ? `/api/maps/${id}`
          : `/api/maps/${id}/reprocess`;
      const res = await fetch(endpoint, {
        method: action === "delete" ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Action failed");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (maps.length === 0) {
    return (
      <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-8 text-center text-sm text-slate-500">
        No maps uploaded yet.{" "}
        <Link href="/dashboard/maps/upload" className="text-cyan-800 underline">
          Upload your first map
        </Link>
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-sky-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-sky-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Map Name</th>
            <th className="px-4 py-3">Uploaded By</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Layers</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {maps.map((map) => (
            <tr key={map.id} className="border-t border-sky-100">
              <td className="px-4 py-3 font-medium text-slate-800">{map.name}</td>
              <td className="px-4 py-3 text-slate-600">
                {map.uploaderName ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatBytes(map.fileSizeBytes)}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-cyan-900">
                  {statusLabel(map.status)}
                </span>
              </td>
              <td className="px-4 py-3">{map.layerCount}</td>
              <td className="px-4 py-3 text-slate-600">
                {map.createdAt
                  ? new Date(map.createdAt).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/maps/viewer?mapId=${map.id}`}
                    className="text-cyan-800 hover:underline"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === map.id}
                    onClick={() => runAction(map.id, "reprocess")}
                    className="text-slate-600 hover:underline disabled:opacity-50"
                  >
                    Reprocess
                  </button>
                  <a
                    href={`/api/maps/${map.id}/download`}
                    className="text-slate-600 hover:underline"
                  >
                    Download
                  </a>
                  <Link
                    href={`/dashboard/maps/jobs?mapId=${map.id}`}
                    className="text-slate-600 hover:underline"
                  >
                    Logs
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === map.id}
                    onClick={() => {
                      if (confirm(`Delete map "${map.name}"?`)) {
                        void runAction(map.id, "delete");
                      }
                    }}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
