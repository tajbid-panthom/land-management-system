"use client";

type SettingsProps = {
  tileServerConfigured: boolean;
  tileServerUrl: string | null;
};

export function GisSettingsPanel({
  tileServerConfigured,
  tileServerUrl,
}: SettingsProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-sky-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Vector Tile Server</h3>
        <p className="mt-1 text-sm text-slate-500">
          Configure <code className="text-xs">PG_TILESERV_URL</code> in{" "}
          <code className="text-xs">.env.local</code> to serve MVT tiles via
          pg_tileserv instead of loading GeoJSON into the browser.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex gap-4">
            <dt className="w-32 text-slate-500">Status</dt>
            <dd className={tileServerConfigured ? "text-green-700" : "text-amber-700"}>
              {tileServerConfigured ? "Configured" : "Not configured (GeoJSON fallback)"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-32 text-slate-500">URL</dt>
            <dd>{tileServerUrl ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-sky-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Python GIS Processor</h3>
        <p className="mt-1 text-sm text-slate-500">
          Install dependencies for MPK/GDB/GPKG support:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
          pip install -r python/requirements.txt
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          ArcGIS <code>.mpk</code> files use <strong>7-Zip</strong> compression (not standard ZIP).
          The <code>py7zr</code> package is required. Without Python, 7z MPK falls back to the
          built-in parser (also uses Python for extraction).
        </p>
      </section>

      <section className="rounded-lg border border-sky-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Permissions</h3>
        <p className="mt-1 text-sm text-slate-500">
          Upload, delete, and reprocess require the{" "}
          <strong>manage_mouza</strong> permission (super_admin, land_officer).
        </p>
      </section>
    </div>
  );
}
