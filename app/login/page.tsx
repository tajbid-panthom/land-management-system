import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/layout/site-header";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard/parcels");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center bg-white px-4 py-16">
        <div className="rounded-xl border border-sky-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Staff sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Land officers, verifiers, and approvers
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </main>
    </>
  );
}
