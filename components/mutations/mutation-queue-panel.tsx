"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth/rbac";
import type { mutationStatusEnum } from "@/lib/db/schema/legal";
import {
  getAvailableMutationTransitions,
  MUTATION_STATUS_LABELS,
} from "@/lib/workflows/state-machines";
import { StatusBadge, statusVariant } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";

export type MutationQueueRow = {
  id: string;
  caseNumber: string;
  status: string | null;
  appliedDate: string | null;
  decisionDate: string | null;
  remarks: string | null;
  plotNumber: string;
  parcelId: string;
  mouzaId: string | null;
  mouzaName: string;
  districtName: string;
  propertyId: string | null;
};

type MutationStatus = (typeof mutationStatusEnum.enumValues)[number];

const STATUS_OPTIONS = [
  "all",
  "not_applied",
  "applied",
  "under_hearing",
  "approved",
  "rejected",
] as const;

function caseHref(row: MutationQueueRow) {
  if (row.propertyId) {
    return `/dashboard/properties/${row.propertyId}/deed`;
  }
  return `/dashboard/parcels/${row.parcelId}/legal`;
}

export function MutationQueuePanel({
  cases,
  userRole,
}: {
  cases: MutationQueueRow[];
  userRole: Role;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [applicantEmail, setApplicantEmail] = useState<Record<string, string>>(
    {},
  );

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cases.filter((mutationCase) => {
      const status = mutationCase.status ?? "not_applied";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        mutationCase.caseNumber,
        mutationCase.plotNumber,
        mutationCase.mouzaName,
        mutationCase.districtName,
        mutationCase.remarks,
        status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [cases, search, statusFilter]);

  const counts = useMemo(() => {
    const summary = {
      not_applied: 0,
      applied: 0,
      under_hearing: 0,
      approved: 0,
      rejected: 0,
    };
    for (const mutationCase of cases) {
      const status = (mutationCase.status ??
        "not_applied") as keyof typeof summary;
      if (status in summary) summary[status] += 1;
    }
    return summary;
  }, [cases]);

  async function transitionCase(
    caseId: string,
    nextStatus: string,
    email?: string,
  ) {
    setLoadingId(caseId);
    setActionError(null);

    const body: Record<string, string> = { caseId, nextStatus };
    if (email) body.applicantEmail = email;

    const res = await fetch("/api/mutations/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data.error ?? "Failed to update mutation status");
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
            ["not_applied", counts.not_applied],
            ["applied", counts.applied],
            ["under_hearing", counts.under_hearing],
            ["approved", counts.approved],
            ["rejected", counts.rejected],
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
              {MUTATION_STATUS_LABELS[status]}
            </p>
            <p className="mt-1 text-2xl font-semibold">{count}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search case, plot, mouza, district…"
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
              {MUTATION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {filteredCases.length === 0 ? (
        <EmptyState
          title="No mutation cases"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "Mutation cases will appear here for maker-checker processing."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Plot</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Map</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((mutationCase) => {
                const status = mutationCase.status ?? "not_applied";
                const actions = getAvailableMutationTransitions(
                  userRole,
                  status as MutationStatus,
                );
                const needsEmail = actions.some(
                  (next) => next === "approved" || next === "rejected",
                );

                return (
                  <tr key={mutationCase.id} className="border-t border-sky-100">
                    <td className="px-4 py-3">
                      <p className="font-medium">{mutationCase.caseNumber}</p>
                      {mutationCase.remarks && (
                        <p className="mt-1 text-xs text-slate-500">
                          {mutationCase.remarks}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={caseHref(mutationCase)}
                        className="text-teal-700 hover:underline"
                      >
                        {mutationCase.plotNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {mutationCase.mouzaName}, {mutationCase.districtName}
                    </td>
                    <td className="px-4 py-3">
                      {mutationCase.appliedDate ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {mutationCase.decisionDate ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={
                          MUTATION_STATUS_LABELS[
                            status as keyof typeof MUTATION_STATUS_LABELS
                          ] ?? status
                        }
                        variant={statusVariant(status)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {mutationCase.mouzaId && mutationCase.plotNumber ? (
                        <Link
                          href={`/dashboard/maps/viewer?mouzaId=${encodeURIComponent(mutationCase.mouzaId)}&plotNo=${encodeURIComponent(mutationCase.plotNumber)}`}
                          className="text-cyan-800 hover:underline"
                        >
                          View on Map
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2">
                        {needsEmail && (
                          <input
                            type="email"
                            placeholder="Applicant email (optional)"
                            value={applicantEmail[mutationCase.id] ?? ""}
                            onChange={(e) =>
                              setApplicantEmail((current) => ({
                                ...current,
                                [mutationCase.id]: e.target.value,
                              }))
                            }
                            className="w-full max-w-56 rounded-md border border-sky-200 px-2 py-1 text-xs"
                          />
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          {actions.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            actions.map((nextStatus) => (
                              <button
                                key={nextStatus}
                                type="button"
                                disabled={loadingId === mutationCase.id}
                                onClick={() =>
                                  transitionCase(
                                    mutationCase.id,
                                    nextStatus,
                                    applicantEmail[mutationCase.id],
                                  )
                                }
                                className="rounded-md border border-sky-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-sky-50 disabled:opacity-60"
                              >
                                {loadingId === mutationCase.id
                                  ? "Saving…"
                                  : MUTATION_STATUS_LABELS[nextStatus]}
                              </button>
                            ))
                          )}
                        </div>
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
