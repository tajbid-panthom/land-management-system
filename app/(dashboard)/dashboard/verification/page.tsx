import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { VerificationQueuePanel } from "@/components/verification/verification-queue-panel";
import { listVerificationQueue } from "@/lib/parcels/queries";
import { getSession } from "@/lib/auth/session";
import { canAccessDashboard } from "@/lib/auth/rbac";

export default async function VerificationPage() {
  const session = await getSession();
  if (!session?.user || !canAccessDashboard(session.user.role)) {
    redirect("/dashboard");
  }

  const records = await listVerificationQueue();

  return (
    <div>
      <PageHeader
        title="Verification Queue"
        description="Field verifiers start review; approvers finalize ownership verification"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Verification Queue" },
        ]}
      />
      <VerificationQueuePanel
        records={records}
        userRole={session.user.role}
      />
    </div>
  );
}
