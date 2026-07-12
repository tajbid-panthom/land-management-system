import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisMapViewer } from "@/components/gis-maps/gis-map-viewer";

export default async function GisViewerPage({
  searchParams,
}: {
  searchParams: Promise<{
    mapId?: string;
    mouzaId?: string;
    plotNo?: string;
    datasetId?: string;
    featureId?: string;
    mauza?: string;
  }>;
}) {
  const { mapId, mouzaId, plotNo, datasetId, featureId, mauza } =
    await searchParams;

  return (
    <div>
      <PageHeader
        title="Map Viewer"
        description="Interactive MapLibre viewer with progressive viewport loading, property documents, and feature inspection"
      />
      <GisSubnav />
      <GisMapViewer
        mapId={mapId}
        focusPlot={
          mouzaId || plotNo || datasetId || featureId
            ? { mouzaId, plotNo, datasetId, featureId, mauza }
            : undefined
        }
      />
    </div>
  );
}
