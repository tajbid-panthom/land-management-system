import { PageHeader } from "@/components/ui/page-header";
import { MouzaAdminPanel } from "@/components/mouza/mouza-admin-panel";

export default function MouzaAdminPage() {
  return (
    <div>
      <PageHeader
        title="Mouza"
        description="Upload shapefiles to sync mouza registry and plot boundaries. View maps and manage registry entries."
      />
      <MouzaAdminPanel />
    </div>
  );
}
