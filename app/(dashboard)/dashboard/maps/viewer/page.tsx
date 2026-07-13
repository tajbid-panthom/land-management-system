import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisMapViewer } from "@/components/gis-maps/gis-map-viewer";
import { getSession } from "@/lib/auth/session";
import { canViewDocumentAudit } from "@/lib/properties/document-auth";

/** Session-dependent props — never serve a cached shell without auth flags. */
export const dynamic = "force-dynamic";

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
  const session = await getSession();
  const canViewDocuments = Boolean(
    session?.user?.id && canViewDocumentAudit(session.user.role),
  );

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
        isAuthenticated={canViewDocuments}
        focusPlot={
          mouzaId || plotNo || datasetId || featureId
            ? { mouzaId, plotNo, datasetId, featureId, mauza }
            : undefined
        }
      />
    </div>
  );
}
