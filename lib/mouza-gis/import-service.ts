import { parseExcelBuffer, validateExcelRow, excelRowToDbValues } from "./excel-import";
import { db } from "@/lib/db";
import { mouzaGisImports, mouzaGisRecords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ImportResult } from "./validations";

const BATCH_SIZE = 200;

export async function importExcelToDataset(
  datasetId: string,
  buffer: Buffer,
  fileName: string,
  userId: string,
): Promise<ImportResult> {
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

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const validationError = validateExcelRow(row, rowNum);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    const values = excelRowToDbValues(row);

    try {
      const duplicateConditions = [
        eq(mouzaGisRecords.datasetId, datasetId),
        eq(mouzaGisRecords.mCode, values.mCode),
      ];
      if (values.plotNo) {
        duplicateConditions.push(eq(mouzaGisRecords.plotNo, values.plotNo));
      }

      const existing = await db
        .select({ id: mouzaGisRecords.id })
        .from(mouzaGisRecords)
        .where(and(...duplicateConditions))
        .limit(1);

      if (existing[0]) {
        await db
          .update(mouzaGisRecords)
          .set({
            ...values,
            importId: importRow.id,
            updatedAt: new Date(),
            mappedAt: null,
            mouzaId: null,
            parcelId: null,
            featureId: null,
          })
          .where(eq(mouzaGisRecords.id, existing[0].id));
        updated++;
      } else {
        await db.insert(mouzaGisRecords).values({
          datasetId,
          importId: importRow.id,
          ...values,
        });
        inserted++;
      }
    } catch (err) {
      errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "Insert failed",
      });
    }
  }

  const success = inserted + updated;
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
  };
}
