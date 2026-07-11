import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { ParcelSearchForm } from "@/components/search/parcel-search-form";

export default function SearchPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl flex-1 bg-white px-4 py-10">
        <h1 className="text-2xl font-semibold">Parcel search</h1>
        <p className="mt-2 text-sm text-slate-600">
          Search by division, district, upazila / thana, union, mouza, JL,
          khatian, and plot/dag number. Public read-only view.
        </p>
        <div className="mt-8 rounded-xl border border-sky-200 bg-white p-6">
          <Suspense fallback={<div className="text-sm text-slate-500">Loading search...</div>}>
            <ParcelSearchForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
