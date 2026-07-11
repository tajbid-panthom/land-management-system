import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-1 flex-col justify-center bg-white px-4 py-16">
        <div className="rounded-2xl border border-cyan-900/10 bg-white p-10 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Bangladesh Land Records
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            Land Management System
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            Unified parcel registry with ownership verification, mutation
            workflows, sensitive document storage, and spatial queries powered
            by PostGIS.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-900"
            >
              Search parcels
            </Link>
            <Link
              href="/dashboard/parcels"
              className="rounded-full border border-sky-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-sky-50"
            >
              Staff dashboard
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-sky-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-sky-50"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Two-tier storage",
                desc: "Cloudinary for maps/photos, R2 for confidential deeds",
              },
              {
                title: "Maker-checker",
                desc: "Mutation and ownership verification workflows",
              },
              {
                title: "Full audit trail",
                desc: "Every change logged with actor, timestamp, and diff",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-lg bg-sky-50 p-4 text-sm"
              >
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
