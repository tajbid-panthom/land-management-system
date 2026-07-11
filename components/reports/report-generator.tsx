"use client";

import { useState } from "react";

export function ReportGenerator() {
  const [parcelId, setParcelId] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcelId }),
    });
    const data = await res.json();
    if (data.jobId) {
      setJobId(data.jobId);
      setStatus("pending");
      pollStatus(data.jobId);
    }
    setLoading(false);
  }

  async function pollStatus(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/reports/generate?jobId=${id}`);
      const data = await res.json();
      setStatus(data.job?.status ?? "unknown");
      if (
        data.job?.status === "completed" ||
        data.job?.status === "failed"
      ) {
        clearInterval(interval);
      }
    }, 2000);
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-white p-6">
      <h2 className="font-semibold">Generate Property Information Report</h2>
      <p className="mt-1 text-sm text-slate-500">
        Aggregates parcel data, renders report, stores in R2, emails link
      </p>
      <form onSubmit={handleGenerate} className="mt-4 flex gap-3">
        <input
          type="text"
          placeholder="Parcel UUID"
          className="flex-1 rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-black"
          value={parcelId}
          onChange={(e) => setParcelId(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-900 disabled:opacity-50"
        >
          {loading ? "Enqueueing..." : "Generate"}
        </button>
      </form>
      {jobId && (
        <p className="mt-3 text-sm text-slate-600">
          Job <code className="rounded bg-sky-100 px-1">{jobId}</code> — status:{" "}
          <strong>{status}</strong>
        </p>
      )}
    </div>
  );
}
