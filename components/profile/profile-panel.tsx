"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth/rbac";

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  land_officer: "Land Officer",
  field_verifier: "Field Verifier",
  approver: "Approver",
  bank_viewer: "Bank Viewer",
  legal_officer: "Legal Officer",
  property_owner: "Property Owner",
  public_user: "Public User",
};

export type ProfileData = {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: string | null;
    createdAt: Date | null;
  };
  linkedOwners: Array<{
    id: string;
    fullName: string;
    fatherOrHusbandName: string | null;
    motherName: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    ownerType: string | null;
    createdAt: Date | null;
  }>;
  propertyCount: number;
};

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value?.trim() || "—"}</dd>
    </div>
  );
}

export function ProfilePanel({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [name, setName] = useState(profile.user.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActive = profile.user.isActive === "true";
  const roleLabel =
    ROLE_LABELS[profile.user.role as Role] ?? profile.user.role;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const body: Record<string, string> = {};
    if (name.trim() !== (profile.user.name ?? "")) {
      body.name = name.trim();
    }
    if (newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }

    if (Object.keys(body).length === 0) {
      setError("No changes to save");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to update profile");
      setLoading(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setMessage("Profile updated successfully");
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-sky-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Account</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your sign-in details and system role
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Name" value={profile.user.name} />
          <DetailItem label="Email" value={profile.user.email} />
          <DetailItem label="Role" value={roleLabel} />
          <DetailItem label="Status" value={isActive ? "Active" : "Inactive"} />
          <DetailItem
            label="Member since"
            value={
              profile.user.createdAt
                ? new Date(profile.user.createdAt).toLocaleDateString()
                : null
            }
          />
          {profile.propertyCount > 0 && (
            <DetailItem
              label="Linked properties"
              value={String(profile.propertyCount)}
            />
          )}
        </dl>
      </section>

      {profile.linkedOwners.length > 0 && (
        <section className="rounded-lg border border-sky-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Owner Registry
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Land record profile linked to your account
          </p>

          <div className="mt-6 space-y-6">
            {profile.linkedOwners.map((owner) => (
              <div
                key={owner.id}
                className="rounded-lg border border-sky-100 bg-sky-50/40 p-4"
              >
                <h3 className="font-medium text-slate-900">{owner.fullName}</h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem
                    label="Father / husband"
                    value={owner.fatherOrHusbandName}
                  />
                  <DetailItem label="Mother" value={owner.motherName} />
                  <DetailItem label="Date of birth" value={owner.dateOfBirth} />
                  <DetailItem label="Phone" value={owner.phone} />
                  <DetailItem label="Email" value={owner.email} />
                  <DetailItem
                    label="Type"
                    value={owner.ownerType ?? "individual"}
                  />
                  <DetailItem label="Address" value={owner.address} />
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-sky-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Edit profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Update your display name or password
        </p>

        <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Current password
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-sky-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                New password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-sky-200 px-3 py-2"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Leave password fields blank to keep your current password.
          </p>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
    </div>
  );
}
