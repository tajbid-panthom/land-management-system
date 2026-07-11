"use client";

import { useState } from "react";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  trigger,
  variant = "danger",
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  trigger: React.ReactNode;
  variant?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-sky-200 px-4 py-2 text-sm text-slate-700 hover:bg-sky-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`rounded-md px-4 py-2 text-sm text-white ${
                  variant === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-teal-700 hover:bg-teal-800"
                }`}
              >
                {loading ? "Processing…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ToastProvider() {
  return null;
}
