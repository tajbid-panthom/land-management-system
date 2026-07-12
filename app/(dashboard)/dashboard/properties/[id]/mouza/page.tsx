import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import {
  GisPropertyInfoPanel,
  ViewOnMapButton,
} from "@/components/properties/gis-property-sync";
import { getPropertyDetail } from "@/lib/properties/queries";
import { getPropertyGisSnapshot } from "@/lib/properties/gis-sync";

export default async function PropertyMouzaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, snapshot] = await Promise.all([
    getPropertyDetail(id),
    getPropertyGisSnapshot(id),
  ]);
  if (!data) notFound();

  const { property } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{property.propertyCode}</h1>
          <p className="text-sm text-slate-500">
            Mouza / GIS Information (synchronized)
          </p>
        </div>
        <ViewOnMapButton href={snapshot?.mapHref} label="Highlight on Map" />
      </div>
      <PropertyTabs propertyId={id} active="mouza" />
      {snapshot ? (
        <GisPropertyInfoPanel
          snapshot={snapshot}
          title="Mouza & Plot GIS Snapshot"
        />
      ) : (
        <div className="rounded-lg border border-sky-200 bg-white p-6 text-sm text-slate-500">
          No synchronized GIS snapshot available for this property yet.
        </div>
      )}
    </div>
  );
}
