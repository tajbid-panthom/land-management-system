import { PageHeader } from "@/components/ui/page-header";
import { GisSubnav } from "@/components/gis-maps/gis-subnav";
import { GisJobList } from "@/components/gis-maps/gis-job-list";
import { listJobs } from "@/lib/gis-maps/queries";

export default async function GisJobsPage() {
  const jobs = await listJobs(100);

  return (
    <div>
      <PageHeader
        title="Processing Jobs"
        description="Background GIS import jobs with progress and error messages"
      />
      <GisSubnav />
      <GisJobList jobs={jobs} />
    </div>
  );
}
