import { parseExcelBuffer, validateExcelRow, excelRowToDbValues, buildRecordKey } from "./excel-import";
import { db } from "@/lib/db";
import { mouzaGisImports, mouzaGisRecords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ImportResult } from "./validations";
import { synchronizeDataset } from "./mapping";

const BATCH_SIZE = 200;

export async function importExcelToDataset(
  datasetId: string,
  buffer: Buffer,
  fileName: string,
  userId: string,
  options?: { autoSync?: boolean },
): Promise<ImportResult> {
  const autoSync = options?.autoSync !== false;
  const { rows, missingColumns } = parseExcelBuffer(buffer);

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required columns: ${missingColumns.join(", ")}`,
    );
  }

  const [importRow] = await db
    .insert(mouzaGisImports)
    .values({
      datasetId,
      fileName,
      importedBy: userId,
      recordCount: rows.length,
      status: "processing",
    })
    .returning();

  const errors: ImportResult["errors"] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const seenKeys = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const validationError = validateExcelRow(row, rowNum);
    if (validationError) {
      errors.push(validationError);
      failed++;
      continue;
    }

    const values = excelRowToDbValues(row);
    const recordKey = buildRecordKey(values.mCode, values.plotNo);

    if (seenKeys.has(recordKey)) {
      errors.push({
        row: rowNum,
        message: `Duplicate row in file (same M_Code + Plot_No as row ${seenKeys.get(recordKey)})`,
        mCode: values.mCode,
        plotNo: values.plotNo ?? undefined,
      });
      skipped++;
      continue;
    }
    seenKeys.set(recordKey, rowNum);

    try {
      const duplicateConditions = [
        eq(mouzaGisRecords.datasetId, datasetId),
        eq(mouzaGisRecords.mCode, values.mCode),
      ];
      if (values.plotNo) {
        duplicateConditions.push(eq(mouzaGisRecords.plotNo, values.plotNo));
      }

      const [existing] = await db
        .select({
          id: mouzaGisRecords.id,
          mouzaId: mouzaGisRecords.mouzaId,
          parcelId: mouzaGisRecords.parcelId,
          featureId: mouzaGisRecords.featureId,
          mauza: mouzaGisRecords.mauza,
          jlNo: mouzaGisRecords.jlNo,
          mAcres: mouzaGisRecords.mAcres,
          landType: mouzaGisRecords.landType,
          landClass: mouzaGisRecords.landClass,
        })
        .from(mouzaGisRecords)
        .where(and(...duplicateConditions))
        .limit(1);

      if (existing) {
        const unchanged =
          existing.mauza === values.mauza &&
          existing.jlNo === values.jlNo &&
          existing.mAcres === values.mAcres &&
          existing.landType === values.landType &&
          existing.landClass === values.landClass;

        if (unchanged) {
          skipped++;
          continue;
        }

        await db
          .update(mouzaGisRecords)
          .set({
            ...values,
            importId: importRow.id,
            updatedAt: new Date(),
            syncStatus: "unmatched",
            syncMessage: "Pending re-synchronization after update",
          })
          .where(eq(mouzaGisRecords.id, existing.id));
        updated++;
      } else {
        await db.insert(mouzaGisRecords).values({
          datasetId,
          importId: importRow.id,
          ...values,
          syncStatus: "unmatched",
          syncMessage: "Pending synchronization",
        });
        inserted++;
      }
    } catch (err) {
      failed++;
      errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "Insert failed",
        mCode: values.mCode,
        plotNo: values.plotNo ?? undefined,
      });
    }
  }

  const success = inserted + updated;
  let sync: ImportResult["sync"] = null;

  if (autoSync && success > 0) {
    try {
      sync = await synchronizeDataset(datasetId);
    } catch (err) {
      errors.push({
        row: 0,
        message: `Auto-sync failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  }

  await db
    .update(mouzaGisImports)
    .set({
      successCount: success,
      errorCount: errors.length,
      status: errors.length === rows.length ? "failed" : "completed",
      errors: errors.length > 0 ? errors : null,
    })
    .where(eq(mouzaGisImports.id, importRow.id));

  return {
    importId: importRow.id,
    total: rows.length,
    success,
    errors,
    updated,
    inserted,
    skipped,
    failed,
    sync,
  };
}
