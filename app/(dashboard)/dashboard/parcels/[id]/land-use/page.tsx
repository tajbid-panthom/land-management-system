import { notFound } from "next/navigation";
import { ParcelTabs } from "@/components/parcels/parcel-tabs";
import { getParcelDetail } from "@/lib/parcels/queries";

export default async function LandUsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getParcelDetail(id);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plot {data.parcel.plotNumber}</h1>
        <p className="text-sm text-slate-500">Land use & planning</p>
      </div>
      <ParcelTabs parcelId={id} active="land-use" />
      {data.landUse.map((u) => (
        <div
          key={u.id}
          className="grid gap-4 rounded-lg border border-sky-200 bg-white p-4 md:grid-cols-2"
        >
          <div>
            <p className="text-xs uppercase text-slate-500">Category</p>
            <p className="font-medium">{u.category ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Zoning</p>
            <p className="font-medium">{u.zoningClassification ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Existing use</p>
            <p>{u.existingUse ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Proposed use</p>
            <p>{u.proposedUse ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Wetland</p>
            <p>{u.wetlandStatus ?? "none"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Master plan ref</p>
            <p>{u.masterPlanRef ?? "—"}</p>
          </div>
        </div>
      ))}
      {data.landUse.length === 0 && (
        <p className="text-sm text-slate-500">No land use records.</p>
      )}
    </div>
  );
}
