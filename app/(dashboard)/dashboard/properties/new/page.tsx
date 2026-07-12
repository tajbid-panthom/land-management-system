import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PropertyCreateForm } from "@/components/properties/property-create-form";

export default function NewPropertyPage() {
  return (
    <div>
      <PageHeader
        title="Create Property"
        description="Register a new land property with location, deed, and document information"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Properties", href: "/dashboard/properties" },
          { label: "Create" },
        ]}
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading form…</p>}>
        <PropertyCreateForm />
      </Suspense>
    </div>
  );
}
