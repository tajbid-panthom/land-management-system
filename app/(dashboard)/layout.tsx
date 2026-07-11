import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canAccessPropertyDashboard } from "@/lib/auth/rbac";
import { SiteHeader } from "@/components/layout/site-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user || !canAccessPropertyDashboard(session.user.role)) {
    redirect("/login");
  }

  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 bg-white">
        <DashboardSidebar />
        <main className="flex-1 bg-white p-6">{children}</main>
      </div>
    </>
  );
}
