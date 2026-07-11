"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/auth/rbac";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/feedback";

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: string | null;
  createdAt: Date | null;
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: (typeof ROLES)[number];
  isActive: boolean;
};

const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  super_admin: "Super Admin",
  land_officer: "Land Officer",
  field_verifier: "Field Verifier",
  approver: "Approver",
  bank_viewer: "Bank Viewer",
  legal_officer: "Legal Officer",
  property_owner: "Property Owner",
  public_user: "Public User",
};

const emptyForm: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "land_officer",
  isActive: true,
};

function userToForm(user: UserRow): UserFormState {
  return {
    name: user.name ?? "",
    email: user.email,
    password: "",
    role: (ROLES.includes(user.role as (typeof ROLES)[number])
      ? user.role
      : "public_user") as (typeof ROLES)[number],
    isActive: user.isActive === "true",
  };
}

function formToPayload(form: UserFormState, includePassword: boolean) {
  const payload: Record<string, string | boolean | undefined> = {
    name: form.name.trim(),
    email: form.email.trim(),
    role: form.role,
    isActive: form.isActive,
  };

  if (includePassword && form.password) {
    payload.password = form.password;
  }

  return payload;
}

function UserFormModal({
  title,
  submitLabel,
  initial,
  requirePassword,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial: UserFormState;
  requirePassword: boolean;
  onClose: () => void;
  onSubmit: (form: UserFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof UserFormState>(
    key: K,
    value: UserFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email *</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Password {requirePassword ? "*" : "(leave blank to keep current)"}
            </span>
            <input
              type="password"
              required={requirePassword}
              minLength={requirePassword ? 8 : undefined}
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Role *</span>
            <select
              value={form.role}
              onChange={(e) =>
                updateField("role", e.target.value as UserFormState["role"])
              }
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="rounded border-sky-300"
            />
            <span className="font-medium text-slate-700">Active account</span>
          </label>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-sky-200 px-4 py-2 text-sm text-slate-700 hover:bg-sky-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {loading ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function parseError(res: Response) {
  const data = await res.json().catch(() => ({}));
  return data.error ?? "Request failed";
}

export function UsersAdminPanel({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return initialUsers;
    return initialUsers.filter((user) => {
      const haystack = [user.name, user.email, user.role, user.isActive]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [initialUsers, search]);

  async function refresh() {
    router.refresh();
  }

  async function createUser(form: UserFormState) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form, true)),
    });
    if (!res.ok) throw new Error(await parseError(res));
    setActionError(null);
    await refresh();
  }

  async function updateUser(id: string, form: UserFormState) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form, true)),
    });
    if (!res.ok) throw new Error(await parseError(res));
    setActionError(null);
    await refresh();
  }

  async function deactivateUser(id: string) {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const message = await parseError(res);
      setActionError(message);
      throw new Error(message);
    }
    setActionError(null);
    await refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-sky-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Add User
        </button>
      </div>

      {actionError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {filteredUsers.length === 0 ? (
        <EmptyState
          title="No users found"
          description={
            search
              ? "Try a different search term."
              : "Add the first system user."
          }
          action={
            !search ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Add User
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isActive = user.isActive === "true";
                const isSelf = user.id === currentUserId;

                return (
                  <tr key={user.id} className="border-t border-sky-100">
                    <td className="px-4 py-3 font-medium">
                      {user.name ?? "—"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-slate-400">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      {ROLE_LABELS[user.role as (typeof ROLES)[number]] ??
                        user.role}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          className="rounded-md border border-sky-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50"
                        >
                          Edit
                        </button>
                        {isActive && !isSelf && (
                          <ConfirmDialog
                            title="Deactivate user"
                            message={`Deactivate ${user.name ?? user.email}? They will no longer be able to sign in.`}
                            confirmLabel="Deactivate"
                            onConfirm={() => deactivateUser(user.id)}
                            trigger={
                              <button
                                type="button"
                                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Deactivate
                              </button>
                            }
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <UserFormModal
          title="Add user"
          submitLabel="Create user"
          initial={emptyForm}
          requirePassword
          onClose={() => setCreateOpen(false)}
          onSubmit={createUser}
        />
      )}

      {editingUser && (
        <UserFormModal
          title={`Edit ${editingUser.name ?? editingUser.email}`}
          submitLabel="Save changes"
          initial={userToForm(editingUser)}
          requirePassword={false}
          onClose={() => setEditingUser(null)}
          onSubmit={(form) => updateUser(editingUser.id, form)}
        />
      )}
    </div>
  );
}
