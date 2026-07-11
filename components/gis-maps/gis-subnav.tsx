"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard/maps/upload", label: "Upload Map" },
  { href: "/dashboard/maps", label: "Uploaded Maps" },
  { href: "/dashboard/maps/layers", label: "Layers" },
  { href: "/dashboard/maps/viewer", label: "Map Viewer" },
  { href: "/dashboard/maps/jobs", label: "Processing Jobs" },
  { href: "/dashboard/maps/settings", label: "Settings" },
];

export function GisSubnav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-sky-200 pb-3">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/dashboard/maps" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              active
                ? "bg-cyan-900 text-white"
                : "bg-sky-50 text-slate-700 hover:bg-sky-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
