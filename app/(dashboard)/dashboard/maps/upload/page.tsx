import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisUploadForm } from "@/components/gis-maps/gis-upload-form";

export default function GisUploadPage() {
  return (
    <div>
      <PageHeader
        title="Upload Map"
        description="Upload MPK, shapefile, geodatabase, or GeoJSON packages for GIS processing"
      />
      <GisSubnav />
      <GisUploadForm />
    </div>
  );
}
