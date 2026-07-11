import { notFound } from "next/navigation";
import { PropertyTabs } from "@/components/properties/property-tabs";
import {
  DocumentUploadForm,
  DocumentDownloadButton,
} from "@/components/properties/document-upload-form";
import { getPropertyDetail } from "@/lib/properties/queries";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";

export default async function PropertyDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const data = await getPropertyDetail(id);
  if (!data) notFound();

  const canUpload =
    session?.user &&
    canPerformPropertyAction(session.user.role, "upload_documents");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.property.propertyCode}</h1>
        <p className="text-sm text-slate-500">Property Documents</p>
      </div>
      <PropertyTabs propertyId={id} active="documents" />

      {canUpload && <DocumentUploadForm propertyId={id} />}

      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((doc) => (
              <tr key={doc.id} className="border-t border-sky-100">
                <td className="px-4 py-3">
                  <DocumentDownloadButton
                    propertyId={id}
                    documentId={doc.id}
                    fileName={doc.fileName}
                  />
                </td>
                <td className="px-4 py-3">{doc.categoryName ?? "—"}</td>
                <td className="px-4 py-3">v{doc.version}</td>
                <td className="px-4 py-3">
                  {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                </td>
                <td className="px-4 py-3">
                  {doc.createdAt?.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.documents.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">
            No documents uploaded yet.
          </p>
        )}
      </div>
    </div>
  );
}
