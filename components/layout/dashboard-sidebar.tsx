import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import {
  isPropertyAdmin,
  isPropertyOwner,
} from "@/lib/auth/rbac";

const profileLink = { href: "/dashboard/profile", label: "My Profile" };

const adminLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/properties", label: "Properties" },
  { href: "/dashboard/owners", label: "Owners" },
  { href: "/dashboard/deeds", label: "Registered Deeds" },
  { href: "/dashboard/mouza", label: "Mouza" },
  { href: "/dashboard/maps", label: "GIS Maps" },
  { href: "/dashboard/khatian", label: "Khatian" },
  { href: "/dashboard/plots", label: "Plots" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/land-planning", label: "Land Planning" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/audit-logs", label: "Audit Logs" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/parcels", label: "Parcels (Legacy)" },
  { href: "/dashboard/mutations", label: "Mutation Queue" },
  { href: "/dashboard/verification", label: "Verification Queue" },
  profileLink,
];

const ownerLinks = [
  { href: "/dashboard/owner", label: "My Dashboard" },
  { href: "/dashboard/properties", label: "My Properties" },
  profileLink,
];

export async function DashboardSidebar() {
  const session = await getSession();
  const role = session?.user?.role;

  let links = adminLinks;
  if (role && isPropertyOwner(role) && !isPropertyAdmin(role)) {
    links = ownerLinks;
  }

  return (
    <aside className="w-56 shrink-0 border-r border-sky-200 bg-white p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {role && isPropertyOwner(role) && !isPropertyAdmin(role)
          ? "Owner Portal"
          : "Admin Panel"}
      </p>
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-sky-50 hover:text-cyan-900"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
