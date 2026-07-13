"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type GeoItem = { id: string; name: string };

export type ParcelSearchResult = {
  id: string;
  plotNumber: string;
  areaValue: string;
  areaUnit: string;
  mouzaId?: string | null;
  mouzaName: string;
  districtName: string;
  jlNumber: string;
  unionName: string | null;
  upazilaName: string | null;
  status: string | null;
  propertyId?: string | null;
  propertyCode?: string | null;
  lng?: number | null;
  lat?: number | null;
};

type ParcelSearchFormProps = {
  onResults?: (results: ParcelSearchResult[]) => void;
  onSelectResult?: (parcel: ParcelSearchResult) => void;
  /** When true, clicking a result does not navigate away to /parcel/[id]. */
  stayOnPage?: boolean;
};

export function ParcelSearchForm({
  onResults,
  onSelectResult,
  stayOnPage = false,
}: ParcelSearchFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plotNumber, setPlotNumber] = useState("");
  const [propertyCode, setPropertyCode] = useState("");
  const [mouzaName, setMouzaName] = useState("");
  const [jlNumber, setJlNumber] = useState("");
  const [khatianNumber, setKhatianNumber] = useState("");
  const [divisions, setDivisions] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [upazilas, setUpazilas] = useState<GeoItem[]>([]);
  const [unions, setUnions] = useState<GeoItem[]>([]);
  const [divisionId, setDivisionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [upazilaId, setUpazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [results, setResults] = useState<ParcelSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadGeo("divisions").then(setDivisions);
  }, []);

  useEffect(() => {
    const code = searchParams.get("propertyCode");
    if (code) {
      setPropertyCode(code);
      fetch(`/api/properties/lookup?code=${encodeURIComponent(code)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.property?.parcelId && !stayOnPage) {
            router.push(`/parcel/${data.property.parcelId}`);
          }
        })
        .catch(() => undefined);
    }
  }, [searchParams, router, stayOnPage]);

  async function loadGeo(
    level: string,
    parentId?: string,
  ): Promise<GeoItem[]> {
    const params = new URLSearchParams({ level });
    if (parentId) params.set("parentId", parentId);
    const res = await fetch(`/api/geography?${params}`);
    const data = await res.json();
    return data.items ?? [];
  }

  async function onDivisionChange(id: string) {
    setDivisionId(id);
    setDistrictId("");
    setUpazilaId("");
    setUnionId("");
    setDistricts([]);
    setUpazilas([]);
    setUnions([]);
    if (id) setDistricts(await loadGeo("districts", id));
  }

  async function onDistrictChange(id: string) {
    setDistrictId(id);
    setUpazilaId("");
    setUnionId("");
    setUpazilas([]);
    setUnions([]);
    if (id) setUpazilas(await loadGeo("upazilas", id));
  }

  async function onUpazilaChange(id: string) {
    setUpazilaId(id);
    setUnionId("");
    setUnions([]);
    if (id) setUnions(await loadGeo("unions", id));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSelectedId(null);
    const params = new URLSearchParams();
    if (plotNumber) params.set("plotNumber", plotNumber);
    if (mouzaName) params.set("mouzaName", mouzaName);
    if (jlNumber) params.set("jlNumber", jlNumber);
    if (khatianNumber) params.set("khatianNumber", khatianNumber);
    if (districtId) params.set("districtId", districtId);
    if (upazilaId) params.set("upazilaId", upazilaId);
    if (unionId) params.set("unionId", unionId);
    if (propertyCode) {
      const lookup = await fetch(
        `/api/properties/lookup?code=${encodeURIComponent(propertyCode)}`,
      );
      const lookupData = await lookup.json();
      if (lookupData.property?.parcelId && !stayOnPage) {
        router.push(`/parcel/${lookupData.property.parcelId}`);
        setLoading(false);
        return;
      }
    }
    const res = await fetch(`/api/parcels?${params}`);
    const data = await res.json();
    const next = (data.parcels ?? []) as ParcelSearchResult[];
    setResults(next);
    onResults?.(next);
    setLoading(false);
  }

  function handleRowClick(parcel: ParcelSearchResult) {
    setSelectedId(parcel.id);
    onSelectResult?.(parcel);
    if (!stayOnPage) {
      router.push(`/parcel/${parcel.id}`);
    }
  }

  const fieldClass =
    "w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-black";

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Division</label>
          <select
            className={fieldClass}
            value={divisionId}
            onChange={(e) => onDivisionChange(e.target.value)}
          >
            <option value="">Select division</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">District</label>
          <select
            className={fieldClass}
            value={districtId}
            onChange={(e) => onDistrictChange(e.target.value)}
            disabled={!divisionId}
          >
            <option value="">Select district</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Upazila / Thana
          </label>
          <select
            className={fieldClass}
            value={upazilaId}
            onChange={(e) => onUpazilaChange(e.target.value)}
            disabled={!districtId}
          >
            <option value="">Select upazila / thana</option>
            {upazilas.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Union</label>
          <select
            className={fieldClass}
            value={unionId}
            onChange={(e) => setUnionId(e.target.value)}
            disabled={!upazilaId}
          >
            <option value="">Select union</option>
            {unions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Property ID</label>
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g. PROP-2026-000001"
            value={propertyCode}
            onChange={(e) => setPropertyCode(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Mouza</label>
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g. Baipail"
            value={mouzaName}
            onChange={(e) => setMouzaName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">JL Number</label>
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g. JL-1042"
            value={jlNumber}
            onChange={(e) => setJlNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Khatian Number</label>
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g. RS-4521"
            value={khatianNumber}
            onChange={(e) => setKhatianNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Plot / Dag Number
          </label>
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g. 125"
            value={plotNumber}
            onChange={(e) => setPlotNumber(e.target.value)}
          />
        </div>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-900 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search parcels"}
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-lg border border-sky-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Plot</th>
                <th className="px-3 py-2">Mouza</th>
                <th className="px-3 py-2">JL</th>
                <th className="px-3 py-2">Area</th>
              </tr>
            </thead>
            <tbody>
              {results.map((p) => (
                <tr
                  key={p.id}
                  className={`cursor-pointer border-t border-sky-100 hover:bg-sky-50 ${
                    selectedId === p.id ? "bg-teal-50" : ""
                  }`}
                  onClick={() => handleRowClick(p)}
                >
                  <td className="px-3 py-2 font-medium">{p.plotNumber}</td>
                  <td className="px-3 py-2">{p.mouzaName}</td>
                  <td className="px-3 py-2">{p.jlNumber}</td>
                  <td className="px-3 py-2">
                    {p.areaValue} {p.areaUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
