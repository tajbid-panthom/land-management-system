"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function UserNav({
  name,
  email,
}: {
  name?: string | null;
  email?: string | null;
}) {
  const displayName = name?.trim() || email || "Account";

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/dashboard/profile"
        prefetch={false}
        className="hidden max-w-40 truncate text-slate-600 transition hover:text-teal-700 sm:inline"
        title={displayName}
      >
        {displayName}
      </Link>
      <Link
        href="/dashboard/profile"
        prefetch={false}
        className="rounded-full border border-sky-200 px-3 py-1.5 text-slate-700 transition hover:bg-sky-50 hover:text-teal-700"
      >
        Profile
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-full bg-teal-700 px-3 py-1.5 text-white hover:bg-cyan-900"
      >
        Sign out
      </button>
    </div>
  );
}
