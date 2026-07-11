import { PageHeader } from "@/components/ui/page-header";
import { MouzaAdminPanel } from "@/components/mouza/mouza-admin-panel";
import { listMouzaRegistry } from "@/lib/mouza-gis/queries";

export default async function MouzaAdminPage() {
  const rows = await listMouzaRegistry(100);

  return (
    <div>
      <PageHeader
        title="Mouza"
        description="Mouza registry, Dhaka North GIS import, DBF mapping, and map view"
      />
      <MouzaAdminPanel initialMouzas={rows} />
    </div>
  );
}
