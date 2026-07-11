"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type GeoItem = { id: string; name: string };
type MouzaOption = { id: string; name: string; jlNumber: string };

function FileUploadField({
  id,
  name,
  label,
  accept,
  fileName,
  onFileChange,
}: {
  id: string;
  name: string;
  label: string;
  accept: string;
  fileName: string | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div className="text-sm">
      <span className="mb-2 block font-medium text-slate-700">{label}</span>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-sky-200 bg-sky-50/50 p-3">
        <label
          htmlFor={id}
          className="cursor-pointer rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Choose file
        </label>
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <span className="min-w-0 flex-1 truncate text-slate-600">
          {fileName ?? "No file selected"}
        </span>
      </div>
    </div>
  );
}

async function loadGeo(
  level: string,
  parentId?: string,
): Promise<GeoItem[] | MouzaOption[]> {
  const params = new URLSearchParams({ level });
  if (parentId) params.set("parentId", parentId);
  const res = await fetch(`/api/geography?${params}`);
  const data = await res.json();
  return data.items ?? [];
}

async function uploadDocument(
  propertyId: string,
  categorySlug: string,
  file: File,
) {
  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadData.append("categorySlug", categorySlug);
  const res = await fetch(`/api/properties/${propertyId}/documents`, {
    method: "POST",
    body: uploadData,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `Failed to upload ${categorySlug}`);
  }
}

export function PropertyCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [divisions, setDivisions] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [upazilas, setUpazilas] = useState<GeoItem[]>([]);
  const [unions, setUnions] = useState<GeoItem[]>([]);
  const [mouzas, setMouzas] = useState<MouzaOption[]>([]);

  const [divisionId, setDivisionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [upazilaId, setUpazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [mouzaId, setMouzaId] = useState("");
  const [khatianFileName, setKhatianFileName] = useState<string | null>(null);
  const [deedFileName, setDeedFileName] = useState<string | null>(null);

  useEffect(() => {
    loadGeo("divisions").then((items) => setDivisions(items as GeoItem[]));
  }, []);

  async function onDivisionChange(id: string) {
    setDivisionId(id);
    setDistrictId("");
    setUpazilaId("");
    setUnionId("");
    setMouzaId("");
    setDistricts([]);
    setUpazilas([]);
    setUnions([]);
    setMouzas([]);
    if (id) {
      setDistricts((await loadGeo("districts", id)) as GeoItem[]);
    }
  }

  async function onDistrictChange(id: string) {
    setDistrictId(id);
    setUpazilaId("");
    setUnionId("");
    setMouzaId("");
    setUpazilas([]);
    setUnions([]);
    setMouzas([]);
    if (id) {
      setUpazilas((await loadGeo("upazilas", id)) as GeoItem[]);
    }
  }

  async function onUpazilaChange(id: string) {
    setUpazilaId(id);
    setUnionId("");
    setMouzaId("");
    setUnions([]);
    setMouzas([]);
    if (id) {
      setUnions((await loadGeo("unions", id)) as GeoItem[]);
    }
  }

  async function onUnionChange(id: string) {
    setUnionId(id);
    setMouzaId("");
    setMouzas([]);
    if (id) {
      setMouzas((await loadGeo("mouzas", id)) as MouzaOption[]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const selectedMouza = mouzas.find((m) => m.id === mouzaId);

    const body = {
      status: form.get("status") || "active",
      location: {
        divisionId: divisionId || undefined,
        districtId: districtId || undefined,
        upazilaId: upazilaId || undefined,
        unionId: unionId || undefined,
        mouzaId,
        plotNumber: form.get("plotNumber"),
        areaValue: form.get("areaValue"),
        areaUnit: form.get("areaUnit"),
        mouzaName: selectedMouza?.name,
        jlNumber: selectedMouza?.jlNumber,
        khatianCs: form.get("khatianCs") || undefined,
        khatianSa: form.get("khatianSa") || undefined,
        khatianRs: form.get("khatianRs") || undefined,
        khatianBs: form.get("khatianBs") || undefined,
      },
      deed: form.get("deedNumber")
        ? {
            deedNumber: form.get("deedNumber"),
            registrationDate: form.get("registrationDate"),
          }
        : undefined,
    };

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create property");
      setLoading(false);
      return;
    }

    const data = await res.json();
    const propertyId = data.property.id as string;

    const khatianCopy = form.get("khatianCopy") as File | null;
    const deedCopy = form.get("deedCopy") as File | null;

    try {
      if (khatianCopy?.size) {
        await uploadDocument(propertyId, "khatian_copy", khatianCopy);
      }
      if (deedCopy?.size) {
        await uploadDocument(propertyId, "deed_copy", deedCopy);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? `Property created, but document upload failed: ${uploadError.message}`
          : "Property created, but document upload failed",
      );
      setLoading(false);
      router.push(`/dashboard/properties/${propertyId}`);
      router.refresh();
      return;
    }

    router.push(`/dashboard/properties/${propertyId}`);
    router.refresh();
  }

  const selectClass =
    "mt-1 w-full rounded-md border border-sky-200 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-sky-200 bg-white p-6"
    >
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Location
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Division
            <select
              required
              value={divisionId}
              onChange={(e) => onDivisionChange(e.target.value)}
              className={selectClass}
            >
              <option value="">Select division</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            District
            <select
              required
              value={districtId}
              onChange={(e) => onDistrictChange(e.target.value)}
              disabled={!divisionId}
              className={selectClass}
            >
              <option value="">Select district</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Upazila / Thana
            <select
              required
              value={upazilaId}
              onChange={(e) => onUpazilaChange(e.target.value)}
              disabled={!districtId}
              className={selectClass}
            >
              <option value="">Select upazila / thana</option>
              {upazilas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Union
            <select
              required
              value={unionId}
              onChange={(e) => onUnionChange(e.target.value)}
              disabled={!upazilaId}
              className={selectClass}
            >
              <option value="">Select union</option>
              {unions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Mouza
            <select
              required
              value={mouzaId}
              onChange={(e) => setMouzaId(e.target.value)}
              disabled={!unionId}
              className={selectClass}
            >
              <option value="">Select mouza</option>
              {mouzas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (JL {m.jlNumber})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Plot / Dag Number
            <input
              name="plotNumber"
              required
              className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Area Value
            <input
              name="areaValue"
              required
              type="number"
              step="any"
              className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Area Unit
            <select
              name="areaUnit"
              required
              className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
            >
              <option value="decimal">Decimal</option>
              <option value="acre">Acre</option>
              <option value="hectare">Hectare</option>
              <option value="sqft">Square Feet</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {(["Cs", "Sa", "Rs", "Bs"] as const).map((type) => (
            <label key={type} className="block text-sm">
              Khatian {type}
              <input
                name={`khatian${type}`}
                className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Documents (optional)
        </h2>
        <p className="text-xs text-slate-500">
          PDF, JPG, PNG, TIFF — max 20 MB each
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FileUploadField
            id="khatianCopy"
            name="khatianCopy"
            label="Khatian Copy"
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
            fileName={khatianFileName}
            onFileChange={(file) => setKhatianFileName(file?.name ?? null)}
          />
          <FileUploadField
            id="deedCopy"
            name="deedCopy"
            label="Deed Copy"
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
            fileName={deedFileName}
            onFileChange={(file) => setDeedFileName(file?.name ?? null)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Registered Deed (optional)
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Deed Number
            <input
              name="deedNumber"
              className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Registration Date
            <input
              name="registrationDate"
              type="date"
              className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <label className="block text-sm">
        Status
        <select
          name="status"
          className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2 md:w-48"
        >
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="disputed">Disputed</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-teal-700 px-6 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create Property"}
      </button>
    </form>
  );
}
