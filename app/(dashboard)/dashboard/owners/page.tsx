import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { OwnersAdminPanel } from "@/components/owners/owners-admin-panel";
import { db } from "@/lib/db";
import { owners } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { isNull } from "drizzle-orm";

export default async function OwnersAdminPage() {
  const session = await getSession();
  if (!session?.user || !isPropertyAdmin(session.user.role)) {
    redirect("/dashboard");
  }

  const rows = await db
    .select({
      id: owners.id,
      fullName: owners.fullName,
      fatherOrHusbandName: owners.fatherOrHusbandName,
      motherName: owners.motherName,
      dateOfBirth: owners.dateOfBirth,
      phone: owners.phone,
      email: owners.email,
      address: owners.address,
      ownerType: owners.ownerType,
    })
    .from(owners)
    .where(isNull(owners.deletedAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Owners"
        description="Create, update, and manage registered property owners"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Owners" },
        ]}
      />
      <OwnersAdminPanel initialOwners={rows} />
    </div>
  );
}
