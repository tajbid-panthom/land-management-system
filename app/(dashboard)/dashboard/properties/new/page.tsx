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
      <PropertyCreateForm />
    </div>
  );
}
