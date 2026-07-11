"use client";

import Link from "next/link";

const tabs = [
  { key: "", label: "Overview" },
  { key: "ownership", label: "Ownership" },
  { key: "legal", label: "Legal" },
  { key: "land-use", label: "Land Use" },
  { key: "documents", label: "Documents" },
  { key: "services", label: "Services" },
] as const;

export function ParcelTabs({
  parcelId,
  active,
  basePath = "/dashboard/parcels",
}: {
  parcelId: string;
  active: string;
  basePath?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-sky-200 pb-3">
      {tabs.map((tab) => {
        const href =
          tab.key === ""
            ? `${basePath}/${parcelId}`
            : `${basePath}/${parcelId}/${tab.key}`;
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key || "overview"}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              isActive
                ? "bg-teal-700 text-white"
                : "text-slate-600 hover:bg-sky-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
