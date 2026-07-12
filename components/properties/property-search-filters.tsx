"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type GeoItem = { id: string; name: string };
type MouzaOption = { id: string; name: string; jlNumber: string | null };
type PlotOption = { id: string; name: string; plotNumber?: string | null };

async function loadGeo(
  level: string,
  parentId?: string,
): Promise<GeoItem[] | MouzaOption[] | PlotOption[]> {
  const params = new URLSearchParams({ level });
  if (parentId) params.set("parentId", parentId);
  const res = await fetch(`/api/geography?${params}`);
  const data = await res.json();
  return data.items ?? [];
}

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
  const [jlNumber, setJlNumber] = useState(searchParams.get("jlNumber") ?? "");

  const [ownerName, setOwnerName] = useState(
    searchParams.get("ownerName") ?? "",
  );
  const [ownerNid, setOwnerNid] = useState(searchParams.get("ownerNid") ?? "");
  const [deedNumber, setDeedNumber] = useState(
    searchParams.get("deedNumber") ?? "",
  );
  const [khatianNumber, setKhatianNumber] = useState(
    searchParams.get("khatianNumber") ?? "",
  );

  const [divisions, setDivisions] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [upazilas, setUpazilas] = useState<GeoItem[]>([]);
  const [mouzas, setMouzas] = useState<MouzaOption[]>([]);
  const [plots, setPlots] = useState<PlotOption[]>([]);

  const [divisionId, setDivisionId] = useState(
    searchParams.get("divisionId") ?? "",
  );
  const [districtId, setDistrictId] = useState(
    searchParams.get("districtId") ?? "",
  );
  const [upazilaId, setUpazilaId] = useState(
    searchParams.get("upazilaId") ?? "",
  );
  const [mouzaId, setMouzaId] = useState(searchParams.get("mouzaId") ?? "");

  useEffect(() => {
    loadGeo("divisions").then((items) => setDivisions(items as GeoItem[]));
  }, []);

  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    loadGeo("districts", divisionId).then((items) =>
      setDistricts(items as GeoItem[]),
    );
  }, [divisionId]);

  useEffect(() => {
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    loadGeo("upazilas", districtId).then((items) =>
      setUpazilas(items as GeoItem[]),
    );
  }, [districtId]);

  useEffect(() => {
    if (!upazilaId) {
      setMouzas([]);
      return;
    }
    loadGeo("mouzas", upazilaId).then((items) =>
      setMouzas(items as MouzaOption[]),
    );
  }, [upazilaId]);

  useEffect(() => {
    if (!mouzaId) {
      setPlots([]);
      return;
    }
    const selected = mouzas.find((m) => m.id === mouzaId);
    if (selected?.jlNumber) setJlNumber(selected.jlNumber);
    loadGeo("plots", mouzaId).then((items) => setPlots(items as PlotOption[]));
  }, [mouzaId, mouzas]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (plotNumber) params.set("plotNumber", plotNumber);
    if (jlNumber) params.set("jlNumber", jlNumber);
    if (divisionId) params.set("divisionId", divisionId);
    if (districtId) params.set("districtId", districtId);
    if (upazilaId) params.set("upazilaId", upazilaId);
    if (mouzaId) params.set("mouzaId", mouzaId);
    if (ownerName) params.set("ownerName", ownerName);
    if (ownerNid) params.set("ownerNid", ownerNid);
    if (deedNumber) params.set("deedNumber", deedNumber);
    if (khatianNumber) params.set("khatianNumber", khatianNumber);
    router.push(`${basePath}?${params.toString()}`);
  }, [
    router,
    basePath,
    search,
    status,
    plotNumber,
    jlNumber,
    divisionId,
    districtId,
    upazilaId,
    mouzaId,
    ownerName,
    ownerNid,
    deedNumber,
    khatianNumber,
  ]);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPlotNumber("");
    setJlNumber("");
    setDivisionId("");
    setDistrictId("");
    setUpazilaId("");
    setMouzaId("");
    setOwnerName("");
    setOwnerNid("");
    setDeedNumber("");
    setKhatianNumber("");
    setDistricts([]);
    setUpazilas([]);
    setMouzas([]);
    setPlots([]);
    router.push(basePath);
  };

  const selectClass =
    "rounded-md border border-sky-200 px-3 py-2 text-sm disabled:bg-slate-50";

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <select
          value={divisionId}
          onChange={(e) => {
            setDivisionId(e.target.value);
            setDistrictId("");
            setUpazilaId("");
            setMouzaId("");
            setPlotNumber("");
          }}
          className={selectClass}
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={districtId}
          disabled={!divisionId}
          onChange={(e) => {
            setDistrictId(e.target.value);
            setUpazilaId("");
            setMouzaId("");
            setPlotNumber("");
          }}
          className={selectClass}
        >
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={upazilaId}
          disabled={!districtId}
          onChange={(e) => {
            setUpazilaId(e.target.value);
            setMouzaId("");
            setPlotNumber("");
          }}
          className={selectClass}
        >
          <option value="">All upazilas / thanas</option>
          {upazilas.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={mouzaId}
          disabled={!upazilaId}
          onChange={(e) => {
            setMouzaId(e.target.value);
            setPlotNumber("");
          }}
          className={selectClass}
        >
          <option value="">All mouzas</option>
          {mouzas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.jlNumber ? ` (JL ${m.jlNumber})` : ""}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="JL Number"
          value={jlNumber}
          onChange={(e) => setJlNumber(e.target.value)}
          className={selectClass}
        />
        <select
          value={plotNumber}
          disabled={!mouzaId && plots.length === 0}
          onChange={(e) => setPlotNumber(e.target.value)}
          className={selectClass}
        >
          <option value="">All plot / dag numbers</option>
          {plots.map((p) => (
            <option key={p.id} value={p.plotNumber ?? p.name}>
              {p.plotNumber ?? p.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search code, plot, mouza…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={selectClass}
        />
        <input
          type="text"
          placeholder="Khatian number"
          value={khatianNumber}
          onChange={(e) => setKhatianNumber(e.target.value)}
          className={selectClass}
        />
        <input
          type="text"
          placeholder="Owner name"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className={selectClass}
        />
        <input
          type="text"
          placeholder="Owner NID"
          value={ownerNid}
          onChange={(e) => setOwnerNid(e.target.value)}
          className={selectClass}
        />
        <input
          type="text"
          placeholder="Registration deed number"
          value={deedNumber}
          onChange={(e) => setDeedNumber(e.target.value)}
          className={selectClass}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="disputed">Disputed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-md border border-sky-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-sky-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
