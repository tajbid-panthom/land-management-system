import Link from "next/link";
import { MapPinned } from "lucide-react";
import type { PropertyGisSnapshot } from "@/lib/properties/gis-sync";

export function ViewOnMapButton({
  href,
  label = "Open in GIS Viewer",
  className,
}: {
  href: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!href) return null;
  return (
    <Link
      href={href}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 transition hover:bg-teal-100"
      }
    >
      <MapPinned size={16} />
      {label}
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

export function GisPropertyInfoPanel({
  snapshot,
  title = "GIS Synchronized Information",
  showDocuments = true,
}: {
  snapshot: PropertyGisSnapshot;
  title?: string;
  showDocuments?: boolean;
}) {
  const syncLabel =
    snapshot.syncStatus === "synced"
      ? "Synced"
      : snapshot.syncStatus === "geometry_missing"
        ? "Geometry missing"
        : snapshot.syncStatus === "unlinked"
          ? "Not linked to GIS"
          : snapshot.syncStatus ?? "Unknown";

  return (
    <section className="space-y-4 rounded-lg border border-sky-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Live from Property + Mouza GIS records · Status:{" "}
            <span className="font-medium text-slate-700">{syncLabel}</span>
            {snapshot.hasGeometry ? " · Geometry available" : ""}
          </p>
        </div>
        <ViewOnMapButton href={snapshot.mapHref} label="Zoom to Plot" />
      </div>

      <dl className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
        <Field label="Division" value={snapshot.division} />
        <Field label="District" value={snapshot.district} />
        <Field label="Upazila / Thana" value={snapshot.upazila} />
        <Field label="Union" value={snapshot.union} />
        <Field label="Mouza" value={snapshot.mouza} />
        <Field label="JL Number" value={snapshot.jlNumber} />
        <Field label="Plot (Dag) Number" value={snapshot.plotNumber} />
        <Field label="Khatian Number" value={snapshot.khatianNumbers} />
        <Field label="Land Class" value={snapshot.landClass} />
        <Field label="Land Type" value={snapshot.landType} />
        <Field
          label="Area"
          value={
            snapshot.area
              ? `${snapshot.area}${snapshot.areaUnit ? ` ${snapshot.areaUnit}` : ""}`
              : null
          }
        />
        <Field label="Revenue Number" value={snapshot.revenueNumber} />
        <Field label="Sheet Number" value={snapshot.sheetNumber} />
        <Field label="Coordinates" value={snapshot.coordinates} />
        <Field label="Geometry Type" value={snapshot.geometryType} />
        <Field label="Property Code" value={snapshot.propertyCode} />
      </dl>

      {showDocuments ? (
        <div className="border-t border-sky-100 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Property Documents
          </h3>
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            {(
              [
                ["Registration Deed", snapshot.documents.registrationDeed],
                ["Mutation Certificate", snapshot.documents.mutationCertificate],
                ["Khatian Copy", snapshot.documents.khatianCopy],
                ["Survey Map", snapshot.documents.surveyMap],
              ] as const
            ).map(([label, available]) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
              >
                <span>{label}</span>
                {available ? (
                  <Link
                    href={`/dashboard/properties/${snapshot.propertyId}/documents`}
                    className="text-teal-700 hover:underline"
                  >
                    View
                  </Link>
                ) : (
                  <span className="text-slate-400">Not Available</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function GisSyncBadge({
  status,
  hasGeometry,
}: {
  status: string;
  hasGeometry?: boolean;
}) {
  const tone =
    status === "synced"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "geometry_missing"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {status === "synced"
        ? hasGeometry === false
          ? "Synced (no geom)"
          : "GIS Synced"
        : status === "unlinked"
          ? "No GIS"
          : status.replace(/_/g, " ")}
    </span>
  );
}
