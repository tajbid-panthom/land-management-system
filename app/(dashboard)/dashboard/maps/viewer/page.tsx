import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisMapViewer } from "@/components/gis-maps/gis-map-viewer";

export default async function GisViewerPage({
  searchParams,
}: {
  searchParams: Promise<{ mapId?: string }>;
}) {
  const { mapId } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Map Viewer"
        description="Interactive MapLibre viewer with layer toggles, search, and feature inspection"
      />
      <GisSubnav />
      <GisMapViewer mapId={mapId} />
    </div>
  );
}
