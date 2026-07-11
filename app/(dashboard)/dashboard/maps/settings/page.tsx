import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisSettingsPanel } from "@/components/gis-maps/gis-settings-panel";
import { getTileServerBaseUrl, isTileServerConfigured } from "@/lib/gis-maps/tiles";

export default function GisSettingsPage() {
  return (
    <div>
      <PageHeader
        title="GIS Settings"
        description="Tile server, Python processor, and permission configuration"
      />
      <GisSubnav />
      <GisSettingsPanel
        tileServerConfigured={isTileServerConfigured()}
        tileServerUrl={getTileServerBaseUrl()}
      />
    </div>
  );
}
