"use client";

import { useEffect, useRef, useState } from "react";

type LayerRow = {
  id: string;
  mapId: string;
  layerName: string;
  geometryType: string | null;
  featureCount: number | null;
  visible: boolean;
  styleJson: Record<string, unknown> | null;
};

export function GisLayerManager({ mapId }: { mapId?: string }) {
  const [maps, setMaps] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedMapId, setSelectedMapId] = useState(mapId ?? "");
  const [layers, setLayers] = useState<LayerRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const patchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch("/api/maps")
      .then((r) => r.json())
      .then((data) => {
        const list = data.maps ?? [];
        setMaps(list);
        setSelectedMapId((prev) => prev || list[0]?.id || "");
      });
  }, []);

  useEffect(() => {
    if (!selectedMapId) return;
    fetch(`/api/maps/layers?mapId=${selectedMapId}`)
      .then((r) => r.json())
      .then((data) => setLayers(data.layers ?? []));
  }, [selectedMapId]);

  const updateLayer = async (
    layerId: string,
    patch: Record<string, unknown>,
  ) => {
    setBusy(layerId);
    try {
      const res = await fetch("/api/maps/layers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layerId, ...patch }),
      });
      if (res.ok) {
        const data = await res.json();
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, ...data.layer } : l)),
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const queueLayerPatch = (
    layerId: string,
    patch: Record<string, unknown>,
    delayMs = 300,
  ) => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;
        const nextStyle = { ...(layer.styleJson ?? {}) } as Record<
          string,
          unknown
        >;
        const nextPaint = {
          ...((nextStyle.paint as Record<string, unknown>) ?? {}),
        };

        if ("color" in patch) {
          const color = patch.color as string;
          nextPaint["fill-color"] = color;
          nextPaint["line-color"] = color;
        }
        if ("opacity" in patch) {
          const opacity = patch.opacity as number;
          nextPaint["fill-opacity"] = opacity;
          nextPaint["line-opacity"] = opacity;
        }
        if ("lineWidth" in patch) {
          nextPaint["line-width"] = patch.lineWidth;
        }
        if ("visible" in patch) {
          return { ...layer, visible: Boolean(patch.visible) };
        }

        nextStyle.paint = nextPaint;
        return { ...layer, styleJson: nextStyle };
      }),
    );

    const existing = patchTimers.current[layerId];
    if (existing) clearTimeout(existing);

    patchTimers.current[layerId] = setTimeout(() => {
      void updateLayer(layerId, patch);
      delete patchTimers.current[layerId];
    }, delayMs);
  };

  useEffect(() => {
    const timers = patchTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-600">Map</label>
        <select
          value={selectedMapId}
          onChange={(e) => setSelectedMapId(e.target.value)}
          className="rounded-md border border-sky-200 px-3 py-2 text-sm"
        >
          <option value="">Select map</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {layers.length === 0 ? (
        <p className="text-sm text-slate-500">No layers for this map.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sky-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Visible</th>
                <th className="px-4 py-3">Layer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Features</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3">Opacity</th>
                <th className="px-4 py-3">Line Width</th>
              </tr>
            </thead>
            <tbody>
              {layers.map((layer) => {
                const paint = (layer.styleJson?.paint ?? {}) as Record<
                  string,
                  unknown
                >;
                const color =
                  (paint["fill-color"] as string) ??
                  (paint["line-color"] as string) ??
                  "#2563eb";
                const opacity =
                  (paint["fill-opacity"] as number) ??
                  (paint["line-opacity"] as number) ??
                  0.35;
                const lineWidth = (paint["line-width"] as number) ?? 2;

                return (
                  <tr key={layer.id} className="border-t border-sky-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        disabled={busy === layer.id}
                        onChange={() =>
                          queueLayerPatch(layer.id, { visible: !layer.visible }, 0)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{layer.layerName}</td>
                    <td className="px-4 py-3">{layer.geometryType}</td>
                    <td className="px-4 py-3">{layer.featureCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <input
                        type="color"
                        value={color}
                        disabled={busy === layer.id}
                        onChange={(e) =>
                          queueLayerPatch(layer.id, { color: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={opacity}
                        disabled={busy === layer.id}
                        onChange={(e) =>
                          queueLayerPatch(layer.id, {
                            opacity: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0.5}
                        max={20}
                        step={0.5}
                        value={lineWidth}
                        disabled={busy === layer.id}
                        className="w-16 rounded border border-sky-200 px-1"
                        onChange={(e) =>
                          queueLayerPatch(layer.id, {
                            lineWidth: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
