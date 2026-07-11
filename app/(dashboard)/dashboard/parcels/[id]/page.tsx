import { notFound } from "next/navigation";
import ParcelOverviewPage from "@/components/parcels/parcel-overview";

export default async function DashboardParcelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ParcelOverviewPage params={Promise.resolve({ id })} />;
}
