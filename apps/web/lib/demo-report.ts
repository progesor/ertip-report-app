import {
  buildCustomerQuotationHistoryReport,
  buildMonthlyQuotationReport,
  buildOpenAgingQuotationReport,
  buildPersonnelPerformanceReport,
  INTERNATIONAL_BUSINESS_UNIT_ID,
  type CustomerQuotationHistoryFilters,
  type CustomerQuotationHistoryReportResult,
  type CustomerQuotationHistorySourceRecord,
  type MonthlyQuotationReportFilters,
  type MonthlyQuotationReportResult,
  type MonthlyQuotationSourceRecord,
  type OpenAgingQuotationReportFilters,
  type OpenAgingQuotationReportResult,
  type OpenAgingQuotationSourceRecord,
  type PersonnelPerformanceFilters,
  type PersonnelPerformanceReportResult,
  type PersonnelPerformanceSourceRecord,
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

type DemoQuotationRecord = MonthlyQuotationSourceRecord &
  OpenAgingQuotationSourceRecord &
  CustomerQuotationHistorySourceRecord &
  PersonnelPerformanceSourceRecord;

function createDemoRecords(): readonly DemoQuotationRecord[] {
  const records: DemoQuotationRecord[] = [];
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
        currencyCode: index % 11 === 0 ? 'EUR' : index % 13 === 0 ? 'TRY' : 'USD',
      });
      id += 1;
    }
  }

  records.push(
    {
      id: 8_901,
      state: 'sent',
      validityDate: '2026-08-18',
      customerId: 101,
      customerName: 'Atlas Hospital Group',
      salespersonId: 10,
      salespersonName: 'Ecem Aygül',
      createDate: '2026-07-21T08:00:00.000Z',
      dateOrder: '2026-07-21T08:00:00.000Z',
      amountTotal: '4200',
      currencyCode: 'EUR',
    },
    {
      id: 8_902,
      state: 'draft',
      validityDate: null,
      customerId: 104,
      customerName: 'Nova Clinic Network',
      salespersonId: null,
      salespersonName: 'Atanmamış',
      createDate: '2026-04-10T08:00:00.000Z',
      dateOrder: '2026-04-10T08:00:00.000Z',
      amountTotal: '97500',
      currencyCode: 'TRY',
    },
  );

  return records;
}

const demoRecords = createDemoRecords();
const demoBusinessUnit = {
  id: INTERNATIONAL_BUSINESS_UNIT_ID,
  displayName: 'Yurt Dışı',
  currencyCode: 'USD',
} as const;
const demoSalespeople = salespeople.map(({ id, name }) => ({ id, displayName: name }));

export function getDemoMonthlyQuotationReport(
  filters: MonthlyQuotationReportFilters,
  generatedAt: Date,
): MonthlyQuotationReportResult {
  return buildMonthlyQuotationReport({
    records: demoRecords,
    filters,
    businessUnit: demoBusinessUnit,
    businessUnits: [demoBusinessUnit],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
  });
}

export function getDemoOpenAgingQuotationReport(
  filters: OpenAgingQuotationReportFilters,
  generatedAt: Date,
  detailLimit = 500,
): OpenAgingQuotationReportResult {
  return buildOpenAgingQuotationReport({
    records: demoRecords,
    filters,
    businessUnit: demoBusinessUnit,
    businessUnits: [demoBusinessUnit],
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
    detailLimit,
  });
}

export function getDemoCustomerQuotationHistoryReport(
  filters: CustomerQuotationHistoryFilters,
  generatedAt: Date,
  timelineLimit = 500,
): CustomerQuotationHistoryReportResult {
  return buildCustomerQuotationHistoryReport({
    records: demoRecords,
    filters,
    businessUnit: demoBusinessUnit,
    businessUnits: [demoBusinessUnit],
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
    timelineLimit,
  });
}

export function getDemoPersonnelPerformanceReport(
  filters: PersonnelPerformanceFilters,
  generatedAt: Date,
  detailLimit = 500,
): PersonnelPerformanceReportResult {
  const salesperson = demoSalespeople.find(({ id }) => id === filters.salespersonId);
  if (!salesperson) {
    throw new Error('REPORT_SALESPERSON_UNAVAILABLE');
  }

  return buildPersonnelPerformanceReport({
    records: demoRecords,
    filters,
    salesperson,
    salespeople: demoSalespeople,
    businessUnit: demoBusinessUnit,
    businessUnits: [demoBusinessUnit],
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
    detailLimit,
  });
}

export function getDemoCustomerQuotationHistoryDirectory(search = '') {
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const groups = new Map<number, DemoQuotationRecord[]>();
  for (const record of demoRecords) {
    groups.set(record.customerId, [...(groups.get(record.customerId) ?? []), record]);
  }

  return [...groups.values()]
    .map((records) => ({
      customerId: records[0]?.customerId ?? 0,
      displayName: records[0]?.customerName ?? 'Demo Customer',
      quotationCount: records.length,
      salespersonCount: new Set(records.map(({ salespersonId }) => salespersonId ?? 'unassigned')).size,
      firstQuotationDate: [...records].sort((left, right) => left.createDate.localeCompare(right.createDate))[0]
        ?.createDate ?? '',
      lastQuotationDate: [...records].sort((left, right) => right.createDate.localeCompare(left.createDate))[0]
        ?.createDate ?? '',
    }))
    .filter(({ displayName }) => !query || displayName.toLocaleLowerCase('tr-TR').includes(query))
    .sort(
      (left, right) =>
        right.lastQuotationDate.localeCompare(left.lastQuotationDate) ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
}

export function getDemoPersonnelPerformanceDirectory(search = '') {
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const groups = new Map<number, DemoQuotationRecord[]>();
  for (const record of demoRecords) {
    if (record.salespersonId === null) continue;
    groups.set(record.salespersonId, [...(groups.get(record.salespersonId) ?? []), record]);
  }

  return [...groups.values()]
    .map((records) => ({
      salespersonId: records[0]?.salespersonId ?? 0,
      displayName: records[0]?.salespersonName ?? 'Demo Personel',
      quotationCount: records.length,
      realizedCount: records.filter(({ state }) => state === 'sale').length,
      customerCount: new Set(records.map(({ customerId }) => customerId)).size,
      firstQuotationDate: [...records].sort((left, right) => left.createDate.localeCompare(right.createDate))[0]
        ?.createDate ?? '',
      lastQuotationDate: [...records].sort((left, right) => right.createDate.localeCompare(left.createDate))[0]
        ?.createDate ?? '',
    }))
    .filter(({ displayName }) => !query || displayName.toLocaleLowerCase('tr-TR').includes(query))
    .sort(
      (left, right) =>
        right.lastQuotationDate.localeCompare(left.lastQuotationDate) ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
}
