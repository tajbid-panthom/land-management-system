import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisMapsTable } from "@/components/gis-maps/gis-maps-table";
import { listMaps } from "@/lib/gis-maps/queries";
import Link from "next/link";

export default async function GisMapsPage() {
  const maps = await listMaps(100);

  return (
    <div>
      <PageHeader
        title="GIS Maps"
        description="Uploaded map packages imported into PostGIS and served to MapLibre"
        actions={
          <Link
            href="/dashboard/maps/upload"
            className="rounded-md bg-cyan-900 px-4 py-2 text-sm text-white"
          >
            Upload Map
          </Link>
        }
      />
      <GisSubnav />
      <GisMapsTable maps={maps} />
    </div>
  );
}
