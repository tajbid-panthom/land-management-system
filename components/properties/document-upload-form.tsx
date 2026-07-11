"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { slug: "deed_copy", name: "Deed Copy" },
  { slug: "khatian_copy", name: "Khatian Copy" },
  { slug: "survey_map", name: "Survey Map" },
  { slug: "mutation_certificate", name: "Mutation Certificate" },
  { slug: "court_documents", name: "Court Documents" },
  { slug: "power_of_attorney", name: "Power of Attorney" },
  { slug: "gis_files", name: "GIS Files" },
  { slug: "other", name: "Other Documents" },
];

export function DocumentUploadForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File;
    if (!file?.size) {
      setError("Please select a file");
      setLoading(false);
      return;
    }

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("categorySlug", form.get("categorySlug") as string);

    const res = await fetch(`/api/properties/${propertyId}/documents`, {
      method: "POST",
      body: uploadData,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Upload failed");
      setLoading(false);
      return;
    }

    e.currentTarget.reset();
    router.refresh();
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-sky-200 bg-sky-50/50 p-4"
    >
      <h3 className="text-sm font-semibold text-slate-900">Upload Document</h3>
      <p className="mt-1 text-xs text-slate-500">
        PDF, JPG, PNG, TIFF — max 20 MB
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <select
          name="categorySlug"
          required
          className="rounded-md border border-sky-200 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
          className="text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}

export function DocumentDownloadButton({
  propertyId,
  documentId,
  fileName,
}: {
  propertyId: string;
  documentId: string;
  fileName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    const res = await fetch(
      `/api/properties/${propertyId}/documents?download=${documentId}`,
    );
    const data = await res.json();
    if (data.url) {
      window.open(data.url, "_blank");
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="text-sm font-medium text-teal-700 hover:underline disabled:opacity-50"
    >
      {loading ? "…" : fileName}
    </button>
  );
}
