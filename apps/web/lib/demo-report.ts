import {
  buildMonthlyQuotationReport,
  INTERNATIONAL_BUSINESS_UNIT_ID,
  type MonthlyQuotationReportFilters,
  type MonthlyQuotationReportResult,
  type MonthlyQuotationSourceRecord,
} from '@ertip/reporting';

const salespeople = [
  { id: 10, name: 'Ecem Aygül' },
  { id: 17, name: 'Mert Demir' },
  { id: 18, name: 'Selin Kaya' },
] as const;
const customers = [
  { id: 101, name: 'Atlas Hospital Group' },
  { id: 102, name: 'Northstar Surgical' },
  { id: 103, name: 'Medline Europe' },
  { id: 104, name: 'Nova Clinic Network' },
  { id: 105, name: 'Orion Healthcare' },
] as const;
const states = ['sale', 'draft', 'sale', 'cancel', 'draft', 'sale', 'draft'] as const;

function createDemoRecords(): readonly MonthlyQuotationSourceRecord[] {
  const records: MonthlyQuotationSourceRecord[] = [];
  let id = 7_500;

  for (let month = 2; month <= 7; month += 1) {
    const count = 12 + month * 3;

    for (let index = 0; index < count; index += 1) {
      const salesperson = salespeople[index % salespeople.length];
      const customer = customers[(index + month) % customers.length];
      const state = states[(index + month * 2) % states.length] ?? 'draft';
      const day = String((index % 24) + 1).padStart(2, '0');
      const monthValue = String(month).padStart(2, '0');
      const createDate = `2026-${monthValue}-${day}T08:${String(index % 60).padStart(2, '0')}:00.000Z`;
      const validityDate =
        state === 'draft'
          ? index % 4 === 0
            ? null
            : `2026-${monthValue}-${String(Math.min((index % 24) + 5, 28)).padStart(2, '0')}`
          : null;

      records.push({
        id,
        state,
        validityDate,
        customerId: customer?.id ?? 101,
        customerName: customer?.name ?? 'Demo Customer',
        salespersonId: index === count - 1 && month === 7 ? null : (salesperson?.id ?? null),
        salespersonName:
          index === count - 1 && month === 7 ? 'Atanmamış' : (salesperson?.name ?? 'Atanmamış'),
        createDate,
        dateOrder: createDate,
        amountTotal: String(750 + index * 125),
        currencyCode: 'USD',
      });
      id += 1;
    }
  }

  return records;
}

const demoRecords = createDemoRecords();

export function getDemoMonthlyQuotationReport(
  filters: MonthlyQuotationReportFilters,
  generatedAt: Date,
): MonthlyQuotationReportResult {
  return buildMonthlyQuotationReport({
    records: demoRecords,
    filters,
    businessUnit: {
      id: INTERNATIONAL_BUSINESS_UNIT_ID,
      displayName: 'Yurt Dışı',
      currencyCode: 'USD',
    },
    businessUnits: [
      {
        id: INTERNATIONAL_BUSINESS_UNIT_ID,
        displayName: 'Yurt Dışı',
        currencyCode: 'USD',
      },
    ],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
  });
}
