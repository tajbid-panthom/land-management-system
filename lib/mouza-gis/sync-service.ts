export { synchronizeDataset, cleanupMouzaSync, rebuildMouzaBoundary, rebuildRecordsFromFeatures } from "./mapping";
export type { MappingResult } from "./mapping";

import { synchronizeDataset } from "./mapping";
import type { SynchronizeReport } from "./validations";

export async function runDatasetSync(
  datasetId: string,
): Promise<SynchronizeReport> {
  return synchronizeDataset(datasetId);
}
