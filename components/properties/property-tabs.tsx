"use client";

import Link from "next/link";

const tabs = [
  { key: "", label: "Profile" },
  { key: "mouza", label: "Mouza" },
  { key: "deed", label: "Registered Deed" },
  { key: "ownership", label: "Ownership" },
  { key: "land-planning", label: "Land Planning" },
  { key: "documents", label: "Documents" },
  { key: "reports", label: "Reports" },
] as const;

const ownerTabs = [
  { key: "", label: "Profile" },
  { key: "deed", label: "Deed Info" },
  { key: "ownership", label: "Ownership" },
  { key: "documents", label: "Documents" },
  { key: "reports", label: "Reports" },
] as const;

export function PropertyTabs({
  propertyId,
  active,
  basePath = "/dashboard/properties",
  isOwner = false,
}: {
  propertyId: string;
  active: string;
  basePath?: string;
  isOwner?: boolean;
}) {
  const visibleTabs = isOwner ? ownerTabs : tabs;

  return (
    <div className="flex flex-wrap gap-2 border-b border-sky-200 pb-3">
      {visibleTabs.map((tab) => {
        const href =
          tab.key === ""
            ? `${basePath}/${propertyId}`
            : `${basePath}/${propertyId}/${tab.key}`;
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key || "profile"}
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
