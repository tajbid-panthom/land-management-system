import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getIntegrationStatus } from "@/lib/settings/config";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user || !isPropertyAdmin(session.user.role)) {
    redirect("/dashboard");
  }

  const integrations = getIntegrationStatus();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="System configuration, integrations, and workflow rules"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />
      <SettingsPanel integrations={integrations} />
    </div>
  );
}
