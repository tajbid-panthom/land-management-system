import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MutationQueuePanel } from "@/components/mutations/mutation-queue-panel";
import { listMutationCases } from "@/lib/parcels/queries";
import { getSession } from "@/lib/auth/session";
import { canAccessDashboard } from "@/lib/auth/rbac";

export default async function MutationsPage() {
  const session = await getSession();
  if (!session?.user || !canAccessDashboard(session.user.role)) {
    redirect("/dashboard");
  }

  const cases = await listMutationCases();

  return (
    <div>
      <PageHeader
        title="Mutation Queue"
        description="Maker-checker workflow: officers apply, approvers finalize"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Mutation Queue" },
        ]}
      />
      <MutationQueuePanel cases={cases} userRole={session.user.role} />
    </div>
  );
}
