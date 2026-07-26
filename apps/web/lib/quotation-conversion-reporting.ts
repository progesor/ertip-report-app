import { queryQuotationConversionReport } from '@ertip/db';
import type {
  QuotationConversionFilters,
  QuotationConversionReportResult,
} from '@ertip/reporting';

import { getAppDatabase } from './database';
import { getReportingPool } from './reporting';

export async function getQuotationConversionReport(input: {
  readonly filters: QuotationConversionFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}): Promise<QuotationConversionReportResult> {
  await getAppDatabase();
  return queryQuotationConversionReport(getReportingPool(), input);
}
