"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function PropertySearchFilters({
  basePath = "/dashboard/properties",
}: {
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [plotNumber, setPlotNumber] = useState(
    searchParams.get("plotNumber") ?? "",
  );

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (plotNumber) params.set("plotNumber", plotNumber);
    router.push(`${basePath}?${params.toString()}`);
  }, [router, basePath, search, status, plotNumber]);

  return (
    <div className="mb-4 grid gap-3 rounded-lg border border-sky-200 bg-sky-50/50 p-4 md:grid-cols-4">
      <input
        type="text"
        placeholder="Search code, plot, mouza…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-md border border-sky-200 px-3 py-2 text-sm"
      />
      <input
        type="text"
        placeholder="Plot / Dag number"
        value={plotNumber}
        onChange={(e) => setPlotNumber(e.target.value)}
        className="rounded-md border border-sky-200 px-3 py-2 text-sm"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-md border border-sky-200 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="disputed">Disputed</option>
        <option value="archived">Archived</option>
      </select>
      <button
        type="button"
        onClick={applyFilters}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Apply filters
      </button>
    </div>
  );
}
