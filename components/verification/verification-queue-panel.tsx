"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth/rbac";
import type { verificationStatusEnum } from "@/lib/db/schema/ownership";
import {
  getAvailableVerificationTransitions,
  VERIFICATION_STATUS_LABELS,
} from "@/lib/workflows/state-machines";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";

export type VerificationQueueRow = {
  id: string;
  verificationStatus: string | null;
  sharePercentage: string;
  effectiveFrom: string;
  ownerName: string;
  plotNumber: string;
  parcelId: string;
  mouzaName: string;
  districtName: string;
  propertyId: string | null;
};

type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number];

const STATUS_OPTIONS = [
  "all",
  "pending",
  "under_review",
  "verified",
  "rejected",
  "disputed",
] as const;

function recordHref(row: VerificationQueueRow) {
  if (row.propertyId) {
    return `/dashboard/properties/${row.propertyId}/ownership`;
  }
  return `/dashboard/parcels/${row.parcelId}/ownership`;
}

export function VerificationQueuePanel({
  records,
  userRole,
}: {
  records: VerificationQueueRow[];
  userRole: Role;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const status = record.verificationStatus ?? "pending";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        record.ownerName,
        record.plotNumber,
        record.mouzaName,
        record.districtName,
        status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [records, search, statusFilter]);

  const counts = useMemo(() => {
    const summary = {
      pending: 0,
      under_review: 0,
      verified: 0,
      rejected: 0,
      disputed: 0,
    };
    for (const record of records) {
      const status = (record.verificationStatus ??
        "pending") as keyof typeof summary;
      if (status in summary) summary[status] += 1;
    }
    return summary;
  }, [records]);

  async function transitionRecord(recordId: string, nextStatus: string) {
    setLoadingId(recordId);
    setActionError(null);

    const res = await fetch("/api/verification/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, nextStatus }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data.error ?? "Failed to update verification status");
      setLoadingId(null);
      return;
    }

    router.refresh();
    setLoadingId(null);
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        {(
          [
            ["pending", counts.pending],
            ["under_review", counts.under_review],
            ["verified", counts.verified],
            ["rejected", counts.rejected],
            ["disputed", counts.disputed],
          ] as const
        ).map(([status, count]) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg border p-3 text-left text-sm ${
              statusFilter === status
                ? "border-teal-300 bg-teal-50"
                : "border-sky-200 bg-white"
            }`}
          >
            <p className="text-xs uppercase text-slate-500">
              {VERIFICATION_STATUS_LABELS[status]}
            </p>
            <p className="mt-1 text-2xl font-semibold">{count}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search owner, plot, mouza, district…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-sky-200 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])
          }
          className="rounded-md border border-sky-200 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.filter((status) => status !== "all").map((status) => (
            <option key={status} value={status}>
              {VERIFICATION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {filteredRecords.length === 0 ? (
        <EmptyState
          title="No verification records"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "Current ownership records will appear here for review."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Plot</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Share</th>
                <th className="px-4 py-3">Effective</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const status = record.verificationStatus ?? "pending";
                const actions = getAvailableVerificationTransitions(
                  userRole,
                  status as VerificationStatus,
                );

                return (
                  <tr key={record.id} className="border-t border-sky-100">
                    <td className="px-4 py-3 font-medium">{record.ownerName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={recordHref(record)}
                        className="text-teal-700 hover:underline"
                      >
                        {record.plotNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.mouzaName}, {record.districtName}
                    </td>
                    <td className="px-4 py-3">{record.sharePercentage}%</td>
                    <td className="px-4 py-3">{record.effectiveFrom}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={VERIFICATION_STATUS_LABELS[status as keyof typeof VERIFICATION_STATUS_LABELS] ?? status}
                        variant={statusVariant(status)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {actions.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          actions.map((nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              disabled={loadingId === record.id}
                              onClick={() =>
                                transitionRecord(record.id, nextStatus)
                              }
                              className="rounded-md border border-sky-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-sky-50 disabled:opacity-60"
                            >
                              {loadingId === record.id
                                ? "Saving…"
                                : VERIFICATION_STATUS_LABELS[nextStatus]}
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
