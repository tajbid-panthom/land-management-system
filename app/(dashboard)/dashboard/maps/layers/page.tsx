import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisLayerManager } from "@/components/gis-maps/gis-layer-manager";

export default async function GisLayersPage({
  searchParams,
}: {
  searchParams: Promise<{ mapId?: string }>;
}) {
  const { mapId } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Layer Manager"
        description="Toggle visibility, colors, opacity, and line width per imported layer"
      />
      <GisSubnav />
      <GisLayerManager mapId={mapId} />
    </div>
  );
}
