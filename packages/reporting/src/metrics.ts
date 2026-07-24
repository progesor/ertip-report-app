export type OdooSaleOrderState = 'draft' | 'sent' | 'sale' | 'cancel' | string;
export type NormalizedQuotationStatus = 'realized' | 'open' | 'expired' | 'cancelled' | 'unknown';

export interface QuotationRecord {
  readonly id: number;
  readonly state: OdooSaleOrderState;
  readonly validityDate?: string | null;
  readonly customerId?: number | null;
}

export interface QuotationMetrics {
  readonly quotationCount: number;
  readonly realizedCount: number;
  readonly openCount: number;
  readonly expiredCount: number;
  readonly cancelledCount: number;
  readonly notRealizedCount: number;
  readonly unknownCount: number;
  readonly quotedCustomerCount: number;
  readonly conversionRate: number | null;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function normalizeQuotationStatus(
  record: Pick<QuotationRecord, 'state' | 'validityDate'>,
  asOfDate: Date,
): NormalizedQuotationStatus {
  if (record.state === 'sale') {
    return 'realized';
  }

  if (record.state === 'cancel') {
    return 'cancelled';
  }

  if (record.state === 'draft' || record.state === 'sent') {
    if (record.validityDate && record.validityDate < toDateOnly(asOfDate)) {
      return 'expired';
    }

    return 'open';
  }

  return 'unknown';
}

export function calculateQuotationMetrics(
  records: readonly QuotationRecord[],
  asOfDate: Date,
): QuotationMetrics {
  const uniqueRecords = new Map(records.map((record) => [record.id, record]));
  const counters = {
    realized: 0,
    open: 0,
    expired: 0,
    cancelled: 0,
    unknown: 0,
  } satisfies Record<NormalizedQuotationStatus, number>;
  const customerIds = new Set<number>();

  for (const record of uniqueRecords.values()) {
    counters[normalizeQuotationStatus(record, asOfDate)] += 1;
    if (typeof record.customerId === 'number') {
      customerIds.add(record.customerId);
    }
  }

  const quotationCount = uniqueRecords.size;

  return {
    quotationCount,
    realizedCount: counters.realized,
    openCount: counters.open,
    expiredCount: counters.expired,
    cancelledCount: counters.cancelled,
    notRealizedCount: counters.expired + counters.cancelled,
    unknownCount: counters.unknown,
    quotedCustomerCount: customerIds.size,
    conversionRate: quotationCount === 0 ? null : counters.realized / quotationCount,
  };
}
