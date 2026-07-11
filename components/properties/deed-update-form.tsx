"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeedUpdateForm({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial?: {
    deedNumber: string;
    registrationDate: string;
    mutationCaseNumber?: string | null;
    namjariStatus?: string | null;
    powerOfAttorney?: string | null;
    litigationStatus?: string | null;
  } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      deedNumber: form.get("deedNumber"),
      registrationDate: form.get("registrationDate"),
      mutationCaseNumber: form.get("mutationCaseNumber") || undefined,
      namjariStatus: form.get("namjariStatus") || undefined,
      powerOfAttorney: form.get("powerOfAttorney") || undefined,
      litigationStatus: form.get("litigationStatus") || undefined,
    };

    const res = await fetch(`/api/properties/${propertyId}/deed`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Update failed");
      setLoading(false);
      return;
    }

    router.refresh();
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-sky-200 bg-white p-6"
    >
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          Registered Deed Number
          <input
            name="deedNumber"
            required
            defaultValue={initial?.deedNumber}
            className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Registration Date
          <input
            name="registrationDate"
            type="date"
            required
            defaultValue={initial?.registrationDate}
            className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Mutation Case
          <input
            name="mutationCaseNumber"
            defaultValue={initial?.mutationCaseNumber ?? ""}
            className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Namjari Status
          <input
            name="namjariStatus"
            defaultValue={initial?.namjariStatus ?? ""}
            className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          Power of Attorney
          <textarea
            name="powerOfAttorney"
            rows={2}
            defaultValue={initial?.powerOfAttorney ?? ""}
            className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          Court Case / Litigation Status
          <input
            name="litigationStatus"
            defaultValue={initial?.litigationStatus ?? ""}
            className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save Deed Information"}
      </button>
    </form>
  );
}
