"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileChooseField } from "@/components/ui/file-choose-field";
import {
  EMPTY_OWNER_DETAILS,
  OwnerDetailsFields,
  type OwnerDetailsValues,
} from "@/components/properties/owner-details-fields";

type GeoItem = { id: string; name: string };
type MouzaOption = { id: string; name: string; jlNumber: string | null };
type PlotOption = {
  id: string;
  name: string;
  plotNumber?: string | null;
};

function FileUploadField({
  id,
  name,
  label,
  accept,
  fileName,
  onFileChange,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  accept: string;
  fileName: string | null;
  onFileChange: (file: File | null) => void;
  hint?: string;
}) {
  return (
    <div className="text-sm">
      <span className="mb-2 block font-medium text-slate-700">{label}</span>
      {hint ? <p className="mb-2 text-xs text-slate-500">{hint}</p> : null}
      <FileChooseField
        id={id}
        name={name}
        accept={accept}
        emptyLabel={fileName ?? "No file selected"}
        onFileChange={onFileChange}
      />
    </div>
  );
}

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

async function uploadDocument(
  propertyId: string,
  categorySlug: string,
  file: File,
  owner: OwnerDetailsValues,
) {
  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadData.append("categorySlug", categorySlug);
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
    throw new Error(data.error ?? `Failed to upload ${categorySlug}`);
  }
}

export function PropertyCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);

  const [divisions, setDivisions] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [upazilas, setUpazilas] = useState<GeoItem[]>([]);
  const [unions, setUnions] = useState<GeoItem[]>([]);
  const [mouzas, setMouzas] = useState<MouzaOption[]>([]);
  const [plots, setPlots] = useState<PlotOption[]>([]);

  const [divisionId, setDivisionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [upazilaId, setUpazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [mouzaId, setMouzaId] = useState("");
  const [jlNumber, setJlNumber] = useState("");
  const [plotNumber, setPlotNumber] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [areaUnit, setAreaUnit] = useState("decimal");
  const [khatianFileName, setKhatianFileName] = useState<string | null>(null);
  const [deedFileName, setDeedFileName] = useState<string | null>(null);
  const [mutationFileName, setMutationFileName] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerDetailsValues>(EMPTY_OWNER_DETAILS);

  useEffect(() => {
    loadGeo("divisions").then((items) => setDivisions(items as GeoItem[]));
  }, []);

  useEffect(() => {
    const fromGis = searchParams.get("fromGis") === "1";
    const district = searchParams.get("district");
    const upazila = searchParams.get("upazila");
    const mouza = searchParams.get("mouza");
    const plotNo = searchParams.get("plotNo");
    const jlNo = searchParams.get("jlNo");
    const mCode = searchParams.get("mCode");
    const area = searchParams.get("areaValue");
    const unit = searchParams.get("areaUnit");
    const prefillKey = searchParams.toString();

    if (!fromGis && !district && !upazila && !mouza && !plotNo) return;
    // Avoid React Strict Mode double-mount skipping the real prefill run.
    if (prefillKeyRef.current === prefillKey) return;

    let cancelled = false;
    setPrefillLoading(true);
    setError(null);

    // Show map attributes immediately while geography UUIDs resolve.
    if (plotNo) setPlotNumber(plotNo);
    if (jlNo) setJlNumber(jlNo);
    if (area) {
      setAreaValue(area);
      setAreaUnit(unit || "acre");
    } else if (fromGis) {
      setAreaValue("0.01");
      setAreaUnit(unit || "acre");
    }
    setPrefillNotice(
      [
        district,
        upazila,
        mouza,
        plotNo ? `Plot ${plotNo}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
        ? `Loading GIS plot into property form: ${[
            district,
            upazila,
            mouza,
            plotNo ? `Plot ${plotNo}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}…`
        : "Opened from GIS map. Resolving location…",
    );

    (async () => {
      try {
        const params = new URLSearchParams({ level: "resolve" });
        if (district) params.set("district", district);
        if (upazila) params.set("upazila", upazila);
        if (mouza) params.set("mouza", mouza);
        if (jlNo) params.set("jlNumber", jlNo);
        if (mCode) params.set("mCode", mCode);
        if (fromGis) params.set("ensure", "1");

        const resolveRes = await fetch(`/api/geography?${params}`);
        if (!resolveRes.ok) {
          throw new Error("Geography resolve failed");
        }
        const resolved = await resolveRes.json();
        if (cancelled) return;

        if (resolved.divisionId) {
          setDivisionId(resolved.divisionId);
          const districtItems = (await loadGeo(
            "districts",
            resolved.divisionId,
          )) as GeoItem[];
          if (cancelled) return;
          setDistricts(districtItems);
        }

        if (resolved.districtId) {
          setDistrictId(resolved.districtId);
          const upazilaItems = (await loadGeo(
            "upazilas",
            resolved.districtId,
          )) as GeoItem[];
          if (cancelled) return;
          // Ensure newly created GIS thana appears in the dropdown.
          if (
            resolved.upazilaId &&
            !upazilaItems.some((u) => u.id === resolved.upazilaId)
          ) {
            upazilaItems.unshift({
              id: resolved.upazilaId,
              name: resolved.upazilaName ?? upazila ?? "GIS Upazila",
            });
          }
          setUpazilas(upazilaItems);
        }

        if (resolved.upazilaId) {
          setUpazilaId(resolved.upazilaId);
          const [unionItems, mouzaItems] = await Promise.all([
            loadGeo("unions", resolved.upazilaId),
            loadGeo("mouzas", resolved.upazilaId),
          ]);
          if (cancelled) return;
          setUnions(unionItems as GeoItem[]);

          let nextMouzas = mouzaItems as MouzaOption[];
          if (
            resolved.mouzaId &&
            !nextMouzas.some((m) => m.id === resolved.mouzaId)
          ) {
            nextMouzas = [
              {
                id: resolved.mouzaId,
                name: resolved.mouzaName ?? mouza ?? "GIS Mouza",
                jlNumber: resolved.jlNumber ?? jlNo,
              },
              ...nextMouzas,
            ];
          }
          setMouzas(nextMouzas);
        }

        // Only narrow by union when it actually returns the resolved mouza.
        if (resolved.unionId) {
          setUnionId(resolved.unionId);
          const mouzaItems = (await loadGeo(
            "mouzas",
            resolved.unionId,
          )) as MouzaOption[];
          if (cancelled) return;
          const hasResolved =
            !resolved.mouzaId ||
            mouzaItems.some((m) => m.id === resolved.mouzaId);
          if (hasResolved && mouzaItems.length > 0) {
            let nextMouzas = mouzaItems;
            if (
              resolved.mouzaId &&
              !nextMouzas.some((m) => m.id === resolved.mouzaId)
            ) {
              nextMouzas = [
                {
                  id: resolved.mouzaId,
                  name: resolved.mouzaName ?? mouza ?? "GIS Mouza",
                  jlNumber: resolved.jlNumber ?? jlNo,
                },
                ...nextMouzas,
              ];
            }
            setMouzas(nextMouzas);
          }
        }

        if (resolved.mouzaId) {
          setMouzaId(resolved.mouzaId);
          const plotItems = (await loadGeo(
            "plots",
            resolved.mouzaId,
          )) as PlotOption[];
          if (cancelled) return;
          setPlots(plotItems);
        }

        setJlNumber(jlNo || resolved.jlNumber || "");
        if (plotNo) setPlotNumber(plotNo);
        if (area) {
          setAreaValue(area);
          setAreaUnit(unit || "acre");
        } else if (fromGis) {
          setAreaValue((prev) => prev || "0.01");
          setAreaUnit(unit || "acre");
        }

        const bits = [
          resolved.districtName ?? district,
          resolved.upazilaName ?? upazila,
          resolved.mouzaName ?? mouza,
          plotNo ? `Plot ${plotNo}` : null,
        ].filter(Boolean);
        const ensuredBits = [
          resolved.ensured?.upazila ? "upazila created" : null,
          resolved.ensured?.mouza ? "mouza created" : null,
        ].filter(Boolean);

        if (!resolved.mouzaId || !resolved.upazilaId || !resolved.districtId) {
          setPrefillNotice(
            `GIS values loaded (${bits.join(" · ") || "partial"}), but some location IDs could not be resolved. Complete any empty dropdowns before saving.`,
          );
        } else {
          setPrefillNotice(
            `Prefilled from GIS plot: ${bits.join(" · ")}${
              ensuredBits.length ? ` (${ensuredBits.join(", ")})` : ""
            }. Add owner details and upload documents if needed.`,
          );
        }

        prefillKeyRef.current = prefillKey;
      } catch {
        if (!cancelled) {
          setPrefillNotice(
            "Opened from GIS map, but geography IDs could not be resolved automatically. Plot/area from the map are filled — select remaining location fields manually.",
          );
        }
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function onDivisionChange(id: string) {
    setDivisionId(id);
    setDistrictId("");
    setUpazilaId("");
    setUnionId("");
    setMouzaId("");
    setJlNumber("");
    setPlotNumber("");
    setDistricts([]);
    setUpazilas([]);
    setUnions([]);
    setMouzas([]);
    setPlots([]);
    if (id) {
      setDistricts((await loadGeo("districts", id)) as GeoItem[]);
    }
  }

  async function onDistrictChange(id: string) {
    setDistrictId(id);
    setUpazilaId("");
    setUnionId("");
    setMouzaId("");
    setJlNumber("");
    setPlotNumber("");
    setUpazilas([]);
    setUnions([]);
    setMouzas([]);
    setPlots([]);
    if (id) {
      setUpazilas((await loadGeo("upazilas", id)) as GeoItem[]);
    }
  }

  async function onUpazilaChange(id: string) {
    setUpazilaId(id);
    setUnionId("");
    setMouzaId("");
    setJlNumber("");
    setPlotNumber("");
    setUnions([]);
    setMouzas([]);
    setPlots([]);
    if (id) {
      const [unionItems, mouzaItems] = await Promise.all([
        loadGeo("unions", id),
        loadGeo("mouzas", id),
      ]);
      setUnions(unionItems as GeoItem[]);
      setMouzas(mouzaItems as MouzaOption[]);
    }
  }

  async function onUnionChange(id: string) {
    setUnionId(id);
    setMouzaId("");
    setJlNumber("");
    setPlotNumber("");
    setMouzas([]);
    setPlots([]);
    if (id) {
      setMouzas((await loadGeo("mouzas", id)) as MouzaOption[]);
    } else if (upazilaId) {
      setMouzas((await loadGeo("mouzas", upazilaId)) as MouzaOption[]);
    }
  }

  async function onMouzaChange(id: string) {
    setMouzaId(id);
    setPlotNumber("");
    setPlots([]);
    const selected = mouzas.find((m) => m.id === id);
    setJlNumber(selected?.jlNumber ?? "");
    if (id) {
      setPlots((await loadGeo("plots", id)) as PlotOption[]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (
      !divisionId ||
      !districtId ||
      !upazilaId ||
      !mouzaId ||
      !jlNumber ||
      !plotNumber
    ) {
      setError(
        "Division, District, Upazila / Thana, Mouza, JL Number, and Plot Number are required",
      );
      setLoading(false);
      return;
    }

    const fromGis = searchParams.get("fromGis") === "1";
    const plotBelongsToMouza =
      fromGis ||
      plots.length === 0 ||
      plots.some(
        (p) => (p.plotNumber ?? p.name) === plotNumber || p.id === plotNumber,
      );
    if (!plotBelongsToMouza) {
      setError("Selected Plot Number must belong to the selected Mouza");
      setLoading(false);
      return;
    }

    if (!owner.fullName.trim()) {
      setError("Property owner full name is required");
      setLoading(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const selectedMouza = mouzas.find((m) => m.id === mouzaId);
    const deedCopy = form.get("deedCopy") as File | null;
    const mutationCopy = form.get("mutationCopy") as File | null;

    if (deedCopy?.size && deedCopy.type !== "application/pdf") {
      setError("Registration Deed must be a PDF file");
      setLoading(false);
      return;
    }
    if (mutationCopy?.size && mutationCopy.type !== "application/pdf") {
      setError("Mutation / Namjari Certificate must be a PDF file");
      setLoading(false);
      return;
    }

    const body = {
      status: form.get("status") || "active",
      location: {
        divisionId,
        districtId,
        upazilaId,
        unionId: unionId || undefined,
        mouzaId,
        plotNumber,
        areaValue: String(form.get("areaValue") || areaValue || "").trim(),
        areaUnit: form.get("areaUnit") || areaUnit,
        mouzaName: selectedMouza?.name,
        jlNumber,
        khatianCs: form.get("khatianCs") || undefined,
        khatianSa: form.get("khatianSa") || undefined,
        khatianRs: form.get("khatianRs") || undefined,
        khatianBs: form.get("khatianBs") || undefined,
      },
      owner: {
        fullName: owner.fullName.trim(),
        fatherOrHusbandName: owner.fatherOrHusbandName.trim() || undefined,
        motherName: owner.motherName.trim() || undefined,
        nid: owner.nid.trim() || undefined,
        phone: owner.phone.trim() || undefined,
        email: owner.email.trim() || undefined,
        dateOfBirth: owner.dateOfBirth.trim() || undefined,
        sharePercentage: Number(owner.sharePercentage || "100"),
      },
      deed: form.get("deedNumber")
        ? {
            deedNumber: form.get("deedNumber"),
            registrationDate: form.get("registrationDate"),
          }
        : undefined,
      featureId: searchParams.get("featureId") || undefined,
      mapId: searchParams.get("mapId") || undefined,
    };

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detailMsg =
        data?.details?.fieldErrors &&
        Object.entries(data.details.fieldErrors as Record<string, string[]>)
          .flatMap(([key, msgs]) =>
            (msgs ?? []).map((m) => `${key}: ${m}`),
          )
          .join("; ");
      setError(data.error ?? detailMsg ?? "Failed to create property");
      setLoading(false);
      return;
    }

    const data = await res.json();
    const propertyId = data.property.id as string;

    const khatianCopy = form.get("khatianCopy") as File | null;

    try {
      if (khatianCopy?.size) {
        await uploadDocument(propertyId, "khatian_copy", khatianCopy, owner);
      }
      if (deedCopy?.size) {
        await uploadDocument(propertyId, "deed_copy", deedCopy, owner);
      }
      if (mutationCopy?.size) {
        await uploadDocument(
          propertyId,
          "mutation_certificate",
          mutationCopy,
          owner,
        );
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

    router.push(`/dashboard/properties/${propertyId}/documents`);
    router.refresh();
  }

  const selectClass =
    "mt-1 w-full rounded-md border border-sky-200 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400";

  const plotInList = plots.some(
    (p) => (p.plotNumber ?? p.name) === plotNumber || p.id === plotNumber,
  );
  const usePlotSelect = plots.length > 0 && (plotInList || !plotNumber);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-sky-200 bg-white p-6"
    >
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {prefillNotice && (
        <p className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
          {prefillNotice}
        </p>
      )}
      {prefillLoading ? (
        <p className="text-sm text-slate-500">
          Resolving GIS location into property fields…
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Location
        </h2>
        <p className="text-xs text-slate-500">
          Cascading selection: Division → District → Upazila / Thana → Mouza →
          JL Number → Plot Number. All fields are mandatory before document
          upload.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Division *
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
            District *
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
            Upazila / Thana *
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
            Union (optional)
            <select
              value={unionId}
              onChange={(e) => onUnionChange(e.target.value)}
              disabled={!upazilaId}
              className={selectClass}
            >
              <option value="">Skip / select union</option>
              {unions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Mouza *
            <select
              required
              value={mouzaId}
              onChange={(e) => onMouzaChange(e.target.value)}
              disabled={!upazilaId}
              className={selectClass}
            >
              <option value="">Select mouza</option>
              {mouzas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.jlNumber ? ` (JL ${m.jlNumber})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            JL Number *
            <input
              required
              value={jlNumber}
              onChange={(e) => setJlNumber(e.target.value)}
              className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Plot / Dag Number *
            {usePlotSelect ? (
              <select
                required
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
                disabled={!mouzaId}
                className={selectClass}
              >
                <option value="">Select plot belonging to mouza</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.plotNumber ?? p.name}>
                    {p.plotNumber ?? p.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
                disabled={!mouzaId}
                placeholder="Enter plot / dag number"
                className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2 disabled:bg-slate-50"
              />
            )}
          </label>
          <label className="block text-sm">
            Area Value
            <input
              name="areaValue"
              required
              type="number"
              step="any"
              value={areaValue}
              onChange={(e) => setAreaValue(e.target.value)}
              className="mt-1 w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Area Unit
            <select
              name="areaUnit"
              required
              value={areaUnit}
              onChange={(e) => setAreaUnit(e.target.value)}
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
        <OwnerDetailsFields
          values={owner}
          onChange={setOwner}
          required
          description="Owner details are required before creating the property and uploading documents."
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Property Documents
        </h2>
        <p className="text-xs text-slate-500">
          Registration Deed and Mutation Certificate accept PDF only (max 20 MB).
          These PDFs are what the map popup opens after the property is linked.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FileUploadField
            id="deedCopy"
            name="deedCopy"
            label="Registration Deed (PDF)"
            accept=".pdf,application/pdf"
            fileName={deedFileName}
            onFileChange={(file) => setDeedFileName(file?.name ?? null)}
            hint="Synced to the GIS plot after upload"
          />
          <FileUploadField
            id="mutationCopy"
            name="mutationCopy"
            label="Mutation / Namjari Certificate (PDF)"
            accept=".pdf,application/pdf"
            fileName={mutationFileName}
            onFileChange={(file) => setMutationFileName(file?.name ?? null)}
            hint="Synced to the GIS plot after upload"
          />
          <FileUploadField
            id="khatianCopy"
            name="khatianCopy"
            label="Khatian Copy"
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
            fileName={khatianFileName}
            onFileChange={(file) => setKhatianFileName(file?.name ?? null)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Registered Deed (optional metadata)
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
        disabled={loading || prefillLoading}
        className="rounded-md bg-teal-700 px-6 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create Property"}
      </button>
    </form>
  );
}
