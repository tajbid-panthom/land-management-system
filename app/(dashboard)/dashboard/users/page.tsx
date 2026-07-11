import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { UsersAdminPanel } from "@/components/users/users-admin-panel";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";

export default async function UsersAdminPage() {
  const session = await getSession();
  if (!session?.user || !isPropertyAdmin(session.user.role)) {
    redirect("/dashboard");
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Create, update, and manage system users and roles"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Users" },
        ]}
      />
      <UsersAdminPanel
        initialUsers={rows}
        currentUserId={session.user.id}
      />
    </div>
  );
}
