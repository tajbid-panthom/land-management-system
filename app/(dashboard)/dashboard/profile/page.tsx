import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { getSession } from "@/lib/auth/session";
import { canAccessPropertyDashboard } from "@/lib/auth/rbac";
import { getUserProfile } from "@/lib/profile/queries";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessPropertyDashboard(session.user.role)) {
    redirect("/login");
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile) {
    redirect("/login");
  }

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="View and update your account details"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Profile" },
        ]}
      />
      <ProfilePanel profile={profile} />
    </div>
  );
}
