"use client";

import { useEffect, useState } from "react";
import { FileChooseField } from "@/components/ui/file-choose-field";

type GeoItem = { id: string; name: string };
type Dataset = {
  id: string;
  name: string;
  slug: string;
  recordCount: number;
  mappedCount: number;
  hasDbf: boolean;
};

export function MouzaCreateForm({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [upazilas, setUpazilas] = useState<GeoItem[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [districtId, setDistrictId] = useState("");
  const [upazilaId, setUpazilaId] = useState("");
  const [name, setName] = useState("");
  const [jlNumber, setJlNumber] = useState("");
  const [mCode, setMCode] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [dbfFileName, setDbfFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mouza-gis/search?level=districts")
      .then((r) => r.json())
      .then((d) => setDistricts(d.items ?? []));
    fetch("/api/mouza-gis/datasets")
      .then((r) => r.json())
      .then((d) => setDatasets(d.datasets ?? []));
  }, []);

  async function onDistrictChange(id: string) {
    setDistrictId(id);
    setUpazilaId("");
    setUpazilas([]);
    if (id) {
      const res = await fetch(`/api/geography?level=upazilas&parentId=${id}`);
      const data = await res.json();
      setUpazilas(data.items ?? []);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/mouzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          jlNumber,
          upazilaId,
          mCode: mCode || undefined,
          datasetId: datasetId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create mouza");

      if (dbfFileName && datasetId) {
        const input = document.getElementById("mouza-shapefile-upload") as HTMLInputElement;
        const file = input?.files?.[0];
        if (file) {
          const formData = new FormData();
          formData.append("datasetId", datasetId);
          formData.append("zip", file);
          const uploadRes = await fetch("/api/mouza-gis/dbf", {
            method: "POST",
            body: formData,
          });
          if (!uploadRes.ok) {
            const uploadData = await uploadRes.json();
            setSuccess(
              `Mouza created. Shapefile warning: ${uploadData.error ?? "failed"}`,
            );
          } else {
            setSuccess("Mouza created and shapefile GeoJSON stored.");
          }
        } else {
          setSuccess("Mouza created successfully.");
        }
      } else {
        setSuccess("Mouza created successfully.");
      }

      setName("");
      setJlNumber("");
      setMCode("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium">District</label>
        <select
          className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm"
          value={districtId}
          onChange={(e) => onDistrictChange(e.target.value)}
          required
        >
          <option value="">Select district</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Upazila / Thana</label>
        <select
          className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm"
          value={upazilaId}
          onChange={(e) => setUpazilaId(e.target.value)}
          disabled={!districtId}
          required
        >
          <option value="">Select upazila / thana</option>
          {upazilas.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Mouza Name</label>
        <input
          type="text"
          className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">JL Number</label>
        <input
          type="text"
          className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm"
          value={jlNumber}
          onChange={(e) => setJlNumber(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">M Code</label>
        <input
          type="text"
          className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm"
          value={mCode}
          onChange={(e) => setMCode(e.target.value)}
          placeholder="GIS mouza code"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">GIS Dataset</label>
        <select
          className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm"
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
        >
          <option value="">None</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-sm font-medium">Shapefile ZIP</label>
        <FileChooseField
          id="mouza-shapefile-upload"
          accept=".zip,application/zip"
          buttonLabel="Choose ZIP"
          emptyLabel="Optional — .shp/.shx/.dbf/.prj ZIP for selected dataset"
          onFileChange={(file) => setDbfFileName(file?.name ?? null)}
        />
      </div>
      {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
      {success && <p className="md:col-span-2 text-sm text-teal-700">{success}</p>}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Mouza"}
        </button>
      </div>
    </form>
  );
}
