import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import { getPropertyDetail } from "@/lib/properties/queries";

export default async function PropertyMouzaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPropertyDetail(id);
  if (!data) notFound();

  const { property } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{property.propertyCode}</h1>
        <p className="text-sm text-slate-500">Mouza Information</p>
      </div>
      <PropertyTabs propertyId={id} active="mouza" />
      <div className="rounded-lg border border-sky-200 bg-white p-6">
        <dl className="grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">Division</dt>
            <dd className="font-medium">{property.divisionName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">District</dt>
            <dd className="font-medium">{property.districtName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Upazila / Thana</dt>
            <dd className="font-medium">{property.upazilaName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Union</dt>
            <dd className="font-medium">{property.unionName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Mouza</dt>
            <dd className="font-medium">{property.mouzaName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">JL Number</dt>
            <dd className="font-medium">{property.jlNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Plot / Dag</dt>
            <dd className="font-medium">{property.plotNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Area (decimal)</dt>
            <dd className="font-medium">{property.areaDecimal}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Area (acre)</dt>
            <dd className="font-medium">{property.areaAcre}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Area (hectare)</dt>
            <dd className="font-medium">{property.areaHectare}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Area (sq ft)</dt>
            <dd className="font-medium">{property.areaSqft}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
