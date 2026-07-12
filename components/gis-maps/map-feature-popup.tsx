"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import Link from "next/link";
import { ExternalLink, FileText, MapPin, Upload } from "lucide-react";
import type { MapRef } from "react-map-gl/maplibre";
import type {
  PopupSection,
  PropertyDocumentAction,
} from "@/lib/gis-maps/feature-popup";
import type { PropertyPopupLink } from "@/lib/gis-maps/property-links";

const POPUP_WIDTH = 320;
const POPUP_MAX_HEIGHT = 420;
const POPUP_MARGIN = 12;
const MARKER_SIZE = 36;
const POPUP_GAP = 10;

type OverlayPosition = {
  marker: { x: number; y: number };
  popup: { x: number; y: number };
};

type MapFeaturePopupProps = {
  open: boolean;
  anchor: { lng: number; lat: number } | null;
  title?: string;
  sections: PopupSection[];
  documents?: PropertyDocumentAction[];
  propertyLinks?: PropertyPopupLink[];
  loading?: boolean;
  suppressEscape?: boolean;
  onClose: () => void;
  onOpenDocument?: (action: PropertyDocumentAction) => void;
  onPositionChange?: (position: OverlayPosition | null) => void;
  mapRef: RefObject<MapRef | null>;
};

function computeOverlayPosition(
  projected: { x: number; y: number },
  popupHeight: number,
  containerWidth: number,
  containerHeight: number,
): OverlayPosition {
  const marker = { x: projected.x, y: projected.y };

  const placeRight = () => ({
    x: projected.x + MARKER_SIZE / 2 + POPUP_GAP,
    y: projected.y - popupHeight / 2,
  });

  const placeLeft = () => ({
    x: projected.x - MARKER_SIZE / 2 - POPUP_GAP - POPUP_WIDTH,
    y: projected.y - popupHeight / 2,
  });

  let popup = placeRight();
  const overflowsRight =
    popup.x + POPUP_WIDTH > containerWidth - POPUP_MARGIN;
  if (overflowsRight) {
    popup = placeLeft();
  }

  const maxX = containerWidth - POPUP_WIDTH - POPUP_MARGIN;
  const maxY = containerHeight - popupHeight - POPUP_MARGIN;
  popup = {
    x: Math.max(POPUP_MARGIN, Math.min(popup.x, maxX)),
    y: Math.max(POPUP_MARGIN, Math.min(popup.y, maxY)),
  };

  return { marker, popup };
}

export function MapFeaturePopup({
  open,
  anchor,
  title,
  sections,
  documents = [],
  propertyLinks = [],
  loading = false,
  suppressEscape = false,
  onClose,
  onOpenDocument,
  onPositionChange,
  mapRef,
}: MapFeaturePopupProps) {
  const titleId = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<OverlayPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!open || !anchor) {
      setPosition(null);
      onPositionChange?.(null);
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map) return;

    const container = map.getContainer();
    const projected = map.project([anchor.lng, anchor.lat]);
    const popupHeight =
      popupRef.current?.offsetHeight ?? POPUP_MAX_HEIGHT + 48;

    const next = computeOverlayPosition(
      { x: projected.x, y: projected.y },
      popupHeight,
      container.clientWidth,
      container.clientHeight,
    );
    setPosition(next);
    onPositionChange?.(next);
  }, [anchor, mapRef, onPositionChange, open]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition, sections, documents, propertyLinks, loading]);

  useEffect(() => {
    if (!open || !anchor) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    const handleMove = () => updatePosition();
    map.on("move", handleMove);
    map.on("zoom", handleMove);
    map.on("resize", handleMove);

    return () => {
      map.off("move", handleMove);
      map.off("zoom", handleMove);
      map.off("resize", handleMove);
    };
  }, [anchor, mapRef, open, updatePosition]);

  useEffect(() => {
    if (!open || suppressEscape) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, suppressEscape]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open, loading]);

  if (!open || !anchor || !position) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full drop-shadow-md"
        style={{
          left: position.marker.x,
          top: position.marker.y,
        }}
      >
        <div className="relative flex items-center justify-center">
          <span className="absolute bottom-1 h-3 w-3 rounded-full bg-amber-500/30 blur-[2px]" />
          <MapPin
            size={MARKER_SIZE}
            className="fill-amber-500 text-amber-600"
            strokeWidth={1.75}
          />
        </div>
      </div>

      <div
        ref={popupRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={title ? titleId : undefined}
        className="pointer-events-auto absolute z-20 flex w-[min(320px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-sky-200 bg-white shadow-xl"
        style={{
          left: position.popup.x,
          top: position.popup.y,
          maxHeight: POPUP_MAX_HEIGHT + 48,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sky-100 bg-linear-to-r from-sky-50 to-white px-4 py-3">
          <div className="min-w-0">
            {title ? (
              <h3
                id={titleId}
                className="truncate text-sm font-semibold text-slate-900"
              >
                {title}
              </h3>
            ) : (
              <h3 id={titleId} className="text-sm font-semibold text-slate-900">
                Feature Details
              </h3>
            )}
            <p className="mt-0.5 text-[11px] text-slate-500">
              {anchor.lat.toFixed(5)}°, {anchor.lng.toFixed(5)}°
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-sky-100 hover:text-slate-700"
            aria-label="Close feature details"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading feature details...</p>
          ) : sections.length === 0 &&
            documents.length === 0 &&
            propertyLinks.length === 0 ? (
            <p className="text-sm text-slate-500">No details available.</p>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <section key={section.title}>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {section.title}
                  </h4>
                  <dl className="space-y-1.5">
                    {section.rows.map((row) => (
                      <div
                        key={`${section.title}-${row.label}`}
                        className="grid grid-cols-[minmax(0,42%)_1fr] gap-2 text-sm"
                      >
                        <dt className="text-slate-500">{row.label}</dt>
                        <dd className="font-medium text-slate-800">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              {documents.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Property Documents
                  </h4>
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li key={doc.kind}>
                        {doc.available ? (
                          <button
                            type="button"
                            onClick={() => onOpenDocument?.(doc)}
                            className="flex w-full items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-left text-sm font-medium text-teal-800 transition hover:bg-teal-100"
                          >
                            <FileText size={16} className="shrink-0" />
                            <span>{doc.label}</span>
                          </button>
                        ) : doc.uploadHref ? (
                          <Link
                            href={doc.uploadHref}
                            className="flex w-full flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm transition hover:bg-amber-100"
                          >
                            <span className="flex items-center gap-2 font-medium text-amber-900">
                              <Upload size={16} className="shrink-0" />
                              Upload {doc.label}
                            </span>
                            {doc.hint ? (
                              <span className="text-[11px] leading-snug text-amber-800/80">
                                {doc.hint}
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            <p className="font-medium text-slate-700">
                              {doc.label}: Not Available
                            </p>
                            {doc.hint ? (
                              <p className="mt-1 text-[11px] leading-snug">
                                {doc.hint}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {propertyLinks.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Property Actions
                  </h4>
                  <div className="space-y-2">
                    {propertyLinks.map((link) => (
                      <Link
                        key={link.href + link.label}
                        href={link.href}
                        className={
                          link.variant === "primary"
                            ? "flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
                            : "flex w-full items-center justify-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-50"
                        }
                      >
                        <ExternalLink size={14} className="shrink-0" />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
