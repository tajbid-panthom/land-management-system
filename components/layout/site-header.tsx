import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { canAccessPropertyDashboard } from "@/lib/auth/rbac";
import { UserNav } from "@/components/layout/user-nav";

const publicNavLinks = [
  { href: "/search", label: "Search" },
];

const dashboardNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/search", label: "Search" },
];

export async function SiteHeader() {
  const session = await getSession();
  const isSignedIn =
    Boolean(session?.user?.id) &&
    canAccessPropertyDashboard(session!.user.role);

  const navLinks = isSignedIn ? dashboardNavLinks : publicNavLinks;

  return (
    <header className="border-b border-cyan-900/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="font-semibold text-cyan-900">
          Land Management System
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-slate-600 transition hover:text-teal-700"
            >
              {link.label}
            </Link>
          ))}
          {isSignedIn ? (
            <UserNav
              name={session?.user?.name}
              email={session?.user?.email}
            />
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-teal-700 px-3 py-1.5 text-white hover:bg-cyan-900"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
