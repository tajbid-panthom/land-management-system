import PropertyOverview from "@/components/properties/property-overview";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PropertyOverview id={id} />;
}
