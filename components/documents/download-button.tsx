"use client";

import { useState } from "react";

export function DocumentDownloadButton({
  documentId,
}: {
  documentId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents/sign-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="text-sm font-medium text-teal-700 hover:underline disabled:opacity-50"
    >
      {loading ? "..." : "Download"}
    </button>
  );
}
