"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Download,
  Minus,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";

type MapPdfViewerProps = {
  open: boolean;
  title: string;
  url: string | null;
  fileName?: string | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  /** Preferred screen position — placed beside the property popup when possible. */
  preferredLeft?: number;
  preferredTop?: number;
};

const VIEWER_WIDTH = 520;
const VIEWER_HEIGHT = 640;
const MARGIN = 12;

export function MapPdfViewer({
  open,
  title,
  url,
  fileName,
  loading = false,
  error = null,
  onClose,
  preferredLeft,
  preferredTop,
}: MapPdfViewerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [fitWidth, setFitWidth] = useState(false);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setPage(1);
    setFitWidth(false);
    closeRef.current?.focus();
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleDownload = useCallback(() => {
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName ?? "document.pdf";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }, [url, fileName]);

  if (!open) return null;

  const left =
    preferredLeft != null
      ? Math.min(
          preferredLeft,
          typeof window !== "undefined"
            ? window.innerWidth - VIEWER_WIDTH - MARGIN
            : preferredLeft,
        )
      : undefined;
  const top =
    preferredTop != null
      ? Math.max(MARGIN, preferredTop)
      : undefined;

  const iframeSrc = url
    ? `${url}#page=${page}${fitWidth ? "&zoom=page-width" : ""}`
    : undefined;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="pointer-events-auto absolute z-30 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{
        width: `min(${VIEWER_WIDTH}px, calc(100% - 24px))`,
        height: `min(${VIEWER_HEIGHT}px, calc(100% - 24px))`,
        left: left ?? MARGIN,
        top: top ?? MARGIN,
        right: left == null ? MARGIN : undefined,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <h3
            id={titleId}
            className="truncate text-sm font-semibold text-slate-900"
          >
            {title}
          </h3>
          {fileName ? (
            <p className="truncate text-[11px] text-slate-500">{fileName}</p>
          ) : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          aria-label="Close PDF viewer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-white px-2 py-1.5">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus size={14} />
        </button>
        <span className="min-w-12 text-center text-[11px] tabular-nums text-slate-600">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            setFitWidth(true);
            setZoom(1);
          }}
          className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          title="Fit to width"
        >
          <Maximize2 size={12} />
          Fit width
        </button>
        <div className="mx-1 h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] tabular-nums text-slate-600">
          Page {page}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!url}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-40"
        >
          <Download size={12} />
          Download
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-slate-100">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading document…
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-red-600">
            <p>{error}</p>
          </div>
        ) : url ? (
          <div
            className="origin-top-left"
            style={{
              transform: fitWidth ? undefined : `scale(${zoom})`,
              width: fitWidth ? "100%" : `${100 / zoom}%`,
              height: fitWidth ? "100%" : `${100 / zoom}%`,
            }}
          >
            <iframe
              key={`${url}-${page}-${fitWidth}`}
              title={title}
              src={iframeSrc}
              className="h-full min-h-[560px] w-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No document URL
          </div>
        )}
      </div>
    </div>
  );
}
