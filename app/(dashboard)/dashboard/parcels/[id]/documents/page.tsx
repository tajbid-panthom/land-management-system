import { notFound } from "next/navigation";
import { ParcelTabs } from "@/components/parcels/parcel-tabs";
import { getParcelDetail } from "@/lib/parcels/queries";
import { DocumentDownloadButton } from "@/components/documents/download-button";

export default async function DocumentsPage({
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
        <p className="text-sm text-slate-500">Documents</p>
      </div>
      <ParcelTabs parcelId={id} active="documents" />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Storage</th>
              <th className="px-4 py-3">Sensitivity</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((d) => (
              <tr key={d.id} className="border-t border-sky-100">
                <td className="px-4 py-3">{d.documentType}</td>
                <td className="px-4 py-3">{d.storageProvider}</td>
                <td className="px-4 py-3">{d.sensitivityLevel}</td>
                <td className="px-4 py-3">{d.isVerified ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <DocumentDownloadButton documentId={d.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.documents.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No documents uploaded.</p>
        )}
      </div>
    </div>
  );
}
