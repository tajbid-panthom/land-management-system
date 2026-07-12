"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Upload } from "lucide-react";
import { DocumentAuditHistory } from "@/components/properties/document-audit-history";
import { FileChooseField } from "@/components/ui/file-choose-field";
import {
  EMPTY_OWNER_DETAILS,
  OwnerDetailsFields,
  type OwnerDetailsValues,
} from "@/components/properties/owner-details-fields";

const CATEGORIES = [
  { slug: "deed_copy", name: "Registration Deed", pdfOnly: true },
  {
    slug: "mutation_certificate",
    name: "Mutation / Namjari Certificate",
    pdfOnly: true,
  },
  { slug: "khatian_copy", name: "Khatian Copy", pdfOnly: false },
  { slug: "survey_map", name: "Survey Map", pdfOnly: false },
  { slug: "court_documents", name: "Court Documents", pdfOnly: false },
  { slug: "power_of_attorney", name: "Power of Attorney", pdfOnly: false },
  { slug: "gis_files", name: "GIS Files", pdfOnly: false },
  { slug: "other", name: "Other Documents", pdfOnly: false },
];

type DocumentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  version: number;
  createdAt: string | Date | null;
  categoryName: string | null;
  categorySlug: string | null;
};

export function DocumentUploadForm({
  propertyId,
  locationComplete,
  missingFields = [],
  replaceDocumentId,
  defaultCategory,
  initialOwner,
  onDone,
}: {
  propertyId: string;
  locationComplete: boolean;
  missingFields?: string[];
  replaceDocumentId?: string;
  defaultCategory?: string;
  initialOwner?: Partial<OwnerDetailsValues> | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState(
    defaultCategory ?? "deed_copy",
  );
  const [owner, setOwner] = useState<OwnerDetailsValues>({
    ...EMPTY_OWNER_DETAILS,
    ...initialOwner,
    sharePercentage: initialOwner?.sharePercentage ?? "100",
  });

  const selected = CATEGORIES.find((c) => c.slug === categorySlug);
  const pdfOnly = selected?.pdfOnly ?? false;
  const blocked = pdfOnly && !locationComplete;

  useEffect(() => {
    if (!initialOwner) return;
    setOwner((prev) => ({
      ...prev,
      ...initialOwner,
      sharePercentage: initialOwner.sharePercentage ?? prev.sharePercentage,
    }));
  }, [initialOwner]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (blocked) {
      setError(
        `Complete property location before uploading: ${missingFields.join(", ")}`,
      );
      setLoading(false);
      return;
    }

    if (!owner.fullName.trim()) {
      setError("Property owner full name is required");
      setLoading(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File;
    if (!file?.size) {
      setError("Please select a file");
      setLoading(false);
      return;
    }

    if (pdfOnly && file.type !== "application/pdf") {
      setError("Only PDF files are accepted for this document type");
      setLoading(false);
      return;
    }

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("categorySlug", categorySlug);
    if (replaceDocumentId) {
      uploadData.append("replaceDocumentId", replaceDocumentId);
    }
    uploadData.append("ownerFullName", owner.fullName.trim());
    uploadData.append(
      "ownerFatherOrHusbandName",
      owner.fatherOrHusbandName.trim(),
    );
    uploadData.append("ownerMotherName", owner.motherName.trim());
    uploadData.append("ownerNid", owner.nid.trim());
    uploadData.append("ownerPhone", owner.phone.trim());
    uploadData.append("ownerEmail", owner.email.trim());
    uploadData.append("ownerDateOfBirth", owner.dateOfBirth.trim());
    uploadData.append(
      "ownerSharePercentage",
      owner.sharePercentage.trim() || "100",
    );

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
    onDone?.();
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-sky-200 bg-sky-50/50 p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {replaceDocumentId ? "Replace Document" : "Upload Document"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Registration Deed and Mutation Certificate: PDF only, max 20 MB.
          Owner details are required with every document upload.
        </p>
      </div>
      {blocked ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Complete these fields before uploading deed/mutation PDFs:{" "}
          {missingFields.join(", ")}
        </p>
      ) : null}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <OwnerDetailsFields values={owner} onChange={setOwner} required />

      <div className="grid gap-3 md:grid-cols-3">
        <select
          name="categorySlug"
          required
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
          className="rounded-md border border-sky-200 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
              {c.pdfOnly ? " (PDF)" : ""}
            </option>
          ))}
        </select>
        <FileChooseField
          name="file"
          accept={
            pdfOnly
              ? ".pdf,application/pdf"
              : ".pdf,.jpg,.jpeg,.png,.tiff,.tif"
          }
          emptyLabel={pdfOnly ? "No PDF selected" : "No file selected"}
        />
        <button
          type="submit"
          disabled={loading || blocked}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-teal-800 bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          <Upload size={14} />
          {loading ? "Uploading…" : replaceDocumentId ? "Replace" : "Upload"}
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

export function DocumentPreviewButton({
  propertyId,
  documentId,
}: {
  propertyId: string;
  documentId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    setLoading(true);
    const res = await fetch(
      `/api/properties/${propertyId}/documents?preview=${documentId}`,
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
      onClick={handlePreview}
      disabled={loading}
      className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-teal-700 disabled:opacity-50"
    >
      <FileText size={14} />
      {loading ? "…" : "Preview"}
    </button>
  );
}

export function DocumentDeleteButton({
  propertyId,
  documentId,
}: {
  propertyId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this document? The property and GIS mapping will be preserved.",
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(
      `/api/properties/${propertyId}/documents?documentId=${documentId}`,
      { method: "DELETE" },
    );
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      <Trash2 size={14} />
      {loading ? "…" : "Delete"}
    </button>
  );
}

export function PropertyDocumentsManager({
  propertyId,
  documents,
  canUpload,
  canViewAudit = false,
  locationComplete,
  missingFields = [],
  initialOwner,
}: {
  propertyId: string;
  documents: DocumentRow[];
  canUpload: boolean;
  canViewAudit?: boolean;
  locationComplete: boolean;
  missingFields?: string[];
  initialOwner?: Partial<OwnerDetailsValues> | null;
}) {
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [metaError, setMetaError] = useState<string | null>(null);
  const router = useRouter();
  const replacingDoc = documents.find((d) => d.id === replacingId);

  useEffect(() => {
    setReplacingId(null);
    setEditingId(null);
  }, [documents]);

  async function saveMetadata(documentId: string) {
    setMetaError(null);
    const res = await fetch(`/api/properties/${propertyId}/documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, fileName: editName }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMetaError(data.error ?? "Failed to update metadata");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <DocumentUploadForm
          propertyId={propertyId}
          locationComplete={locationComplete}
          missingFields={missingFields}
          replaceDocumentId={replacingId ?? undefined}
          defaultCategory={replacingDoc?.categorySlug ?? "deed_copy"}
          initialOwner={initialOwner}
          onDone={() => setReplacingId(null)}
        />
      )}

      {metaError ? (
        <p className="text-sm text-red-600">{metaError}</p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-t border-sky-100">
                <td className="px-4 py-3">
                  {editingId === doc.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded border border-sky-200 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void saveMetadata(doc.id)}
                        className="text-sm text-teal-700 hover:underline"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-sm text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <DocumentDownloadButton
                      propertyId={propertyId}
                      documentId={doc.id}
                      fileName={doc.fileName}
                    />
                  )}
                </td>
                <td className="px-4 py-3">{doc.categoryName ?? "—"}</td>
                <td className="px-4 py-3">v{doc.version}</td>
                <td className="px-4 py-3">
                  {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                </td>
                <td className="px-4 py-3">
                  {doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <DocumentPreviewButton
                      propertyId={propertyId}
                      documentId={doc.id}
                    />
                    {canUpload ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setReplacingId(doc.id)}
                          className="text-sm text-slate-600 hover:text-teal-700"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(doc.id);
                            setEditName(doc.fileName);
                          }}
                          className="text-sm text-slate-600 hover:text-teal-700"
                        >
                          Rename
                        </button>
                        <DocumentDeleteButton
                          propertyId={propertyId}
                          documentId={doc.id}
                        />
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {documents.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">
            No documents uploaded yet.
          </p>
        )}
      </div>

      {canViewAudit ? <DocumentAuditHistory propertyId={propertyId} /> : null}
    </div>
  );
}
