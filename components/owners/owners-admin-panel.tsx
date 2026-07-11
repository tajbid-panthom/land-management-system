"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/feedback";

export type OwnerRow = {
  id: string;
  fullName: string;
  fatherOrHusbandName?: string | null;
  motherName?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  ownerType?: string | null;
};

type OwnerFormState = {
  fullName: string;
  fatherOrHusbandName: string;
  motherName: string;
  dateOfBirth: string;
  nid: string;
  phone: string;
  email: string;
  address: string;
  ownerType: "individual" | "organization";
};

const emptyForm: OwnerFormState = {
  fullName: "",
  fatherOrHusbandName: "",
  motherName: "",
  dateOfBirth: "",
  nid: "",
  phone: "",
  email: "",
  address: "",
  ownerType: "individual",
};

function ownerToForm(owner: OwnerRow): OwnerFormState {
  return {
    fullName: owner.fullName,
    fatherOrHusbandName: owner.fatherOrHusbandName ?? "",
    motherName: owner.motherName ?? "",
    dateOfBirth: owner.dateOfBirth ?? "",
    nid: "",
    phone: owner.phone ?? "",
    email: owner.email ?? "",
    address: owner.address ?? "",
    ownerType:
      owner.ownerType === "organization" ? "organization" : "individual",
  };
}

function formToPayload(form: OwnerFormState, includeNid: boolean) {
  const payload: Record<string, string | undefined> = {
    fullName: form.fullName.trim(),
    fatherOrHusbandName: form.fatherOrHusbandName.trim() || undefined,
    motherName: form.motherName.trim() || undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    address: form.address.trim() || undefined,
    ownerType: form.ownerType,
  };

  if (includeNid && form.nid.trim()) {
    payload.nid = form.nid.trim();
  }

  return payload;
}

function OwnerFormModal({
  title,
  submitLabel,
  initial,
  includeNid,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial: OwnerFormState;
  includeNid: boolean;
  onClose: () => void;
  onSubmit: (form: OwnerFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof OwnerFormState>(
    key: K,
    value: OwnerFormState[K],
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              Full name *
            </span>
            <input
              required
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Father / husband name
            </span>
            <input
              value={form.fatherOrHusbandName}
              onChange={(e) =>
                updateField("fatherOrHusbandName", e.target.value)
              }
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Mother name
            </span>
            <input
              value={form.motherName}
              onChange={(e) => updateField("motherName", e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Date of birth
            </span>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => updateField("dateOfBirth", e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Type</span>
            <select
              value={form.ownerType}
              onChange={(e) =>
                updateField(
                  "ownerType",
                  e.target.value as OwnerFormState["ownerType"],
                )
              }
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            >
              <option value="individual">Individual</option>
              <option value="organization">Organization</option>
            </select>
          </label>

          {includeNid && (
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">NID</span>
              <input
                value={form.nid}
                onChange={(e) => updateField("nid", e.target.value)}
                placeholder="10, 13, or 17 digits"
                className="w-full rounded-md border border-sky-200 px-3 py-2"
              />
            </label>
          )}

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Phone</span>
            <input
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Address</span>
            <textarea
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-sky-200 px-3 py-2"
            />
          </label>

          {error && (
            <p className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 md:col-span-2">
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

export function OwnersAdminPanel({ initialOwners }: { initialOwners: OwnerRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<OwnerRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredOwners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return initialOwners;
    return initialOwners.filter((owner) => {
      const haystack = [
        owner.fullName,
        owner.phone,
        owner.email,
        owner.ownerType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [initialOwners, search]);

  async function refresh() {
    router.refresh();
  }

  async function createOwner(form: OwnerFormState) {
    const res = await fetch("/api/owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form, true)),
    });
    if (!res.ok) throw new Error(await parseError(res));
    setActionError(null);
    await refresh();
  }

  async function updateOwner(id: string, form: OwnerFormState) {
    const res = await fetch(`/api/owners/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form, true)),
    });
    if (!res.ok) throw new Error(await parseError(res));
    setActionError(null);
    await refresh();
  }

  async function deleteOwner(id: string) {
    const res = await fetch(`/api/owners/${id}`, { method: "DELETE" });
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
          placeholder="Search owners…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-sky-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Add Owner
        </button>
      </div>

      {actionError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {filteredOwners.length === 0 ? (
        <EmptyState
          title="No owners found"
          description={
            search
              ? "Try a different search term."
              : "Add the first owner to the registry."
          }
          action={
            !search ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Add Owner
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
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOwners.map((owner) => (
                <tr key={owner.id} className="border-t border-sky-100">
                  <td className="px-4 py-3 font-medium">{owner.fullName}</td>
                  <td className="px-4 py-3">{owner.phone ?? "—"}</td>
                  <td className="px-4 py-3">{owner.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">
                    {owner.ownerType ?? "individual"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingOwner(owner)}
                        className="rounded-md border border-sky-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50"
                      >
                        Edit
                      </button>
                      <ConfirmDialog
                        title="Delete owner"
                        message={`Remove ${owner.fullName} from the registry? This cannot be undone if the owner has no active property links.`}
                        confirmLabel="Delete"
                        onConfirm={() => deleteOwner(owner.id)}
                        trigger={
                          <button
                            type="button"
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <OwnerFormModal
          title="Add owner"
          submitLabel="Create owner"
          initial={emptyForm}
          includeNid
          onClose={() => setCreateOpen(false)}
          onSubmit={createOwner}
        />
      )}

      {editingOwner && (
        <OwnerFormModal
          title={`Edit ${editingOwner.fullName}`}
          submitLabel="Save changes"
          initial={ownerToForm(editingOwner)}
          includeNid
          onClose={() => setEditingOwner(null)}
          onSubmit={(form) => updateOwner(editingOwner.id, form)}
        />
      )}
    </div>
  );
}
