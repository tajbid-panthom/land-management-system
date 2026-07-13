import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SearchWithGisMap } from "@/components/search/search-with-gis-map";
import { getSession } from "@/lib/auth/session";
import { canViewDocumentAudit } from "@/lib/properties/document-auth";

export default async function SearchPage() {
  const session = await getSession();
  const isAuthenticated = Boolean(session?.user?.id);
  // Super admin, land officer, and legal officer can open deeds & mutation PDFs.
  const canViewDocuments = Boolean(
    session?.user?.id && canViewDocumentAudit(session.user.role),
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col bg-slate-50 px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Parcel search & GIS map
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Search beside the map. Until you search, the map stays browse-only.
            After a match, select a plot to focus it. Registration deeds and
            mutation certificates appear for signed-in admins (including super
            admin).
          </p>
        </div>
        <Suspense
          fallback={
            <div className="rounded-xl border border-sky-200 bg-white p-6 text-sm text-slate-500">
              Loading search and map…
            </div>
          }
        >
          <SearchWithGisMap
            isAuthenticated={isAuthenticated}
            canViewDocuments={canViewDocuments}
          />
        </Suspense>
      </main>
    </>
  );
}
