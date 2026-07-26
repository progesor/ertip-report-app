import {
  buildQuotationConversionReport,
  type QuotationConversionFilters,
  type QuotationConversionReportResult,
  type QuotationConversionSourceRecord,
} from '@ertip/reporting';

const businessUnit = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Yurt Dışı',
  currencyCode: 'USD',
} as const;

function record(input: {
  readonly id: number;
  readonly state: string;
  readonly createDate: string;
  readonly dateOrder?: string;
  readonly salespersonId: number;
  readonly salespersonName: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly amountTotal: string;
  readonly currencyCode?: string;
}): QuotationConversionSourceRecord {
  return {
    id: input.id,
    state: input.state,
    createDate: `${input.createDate}T08:30:00.000Z`,
    dateOrder: `${input.dateOrder ?? input.createDate}T10:00:00.000Z`,
    validityDate: null,
    salespersonId: input.salespersonId,
    salespersonName: input.salespersonName,
    customerId: input.customerId,
    customerName: input.customerName,
    amountTotal: input.amountTotal,
    currencyCode: input.currencyCode ?? 'USD',
  };
}

const records: readonly QuotationConversionSourceRecord[] = [
  record({ id: 4101, state: 'sale', createDate: '2026-07-02', dateOrder: '2026-07-02', salespersonId: 10, salespersonName: 'Ecem Aygül', customerId: 101, customerName: 'Atlas Medical', amountTotal: '1200' }),
  record({ id: 4102, state: 'sale', createDate: '2026-07-04', dateOrder: '2026-07-09', salespersonId: 10, salespersonName: 'Ecem Aygül', customerId: 102, customerName: 'Northstar Health', amountTotal: '2400' }),
  record({ id: 4103, state: 'draft', createDate: '2026-07-07', salespersonId: 10, salespersonName: 'Ecem Aygül', customerId: 103, customerName: 'Medline Europe', amountTotal: '1800', currencyCode: 'EUR' }),
  record({ id: 4104, state: 'sale', createDate: '2026-07-10', dateOrder: '2026-08-12', salespersonId: 17, salespersonName: 'Mert Demir', customerId: 104, customerName: 'Nova Surgical', amountTotal: '5200' }),
  record({ id: 4105, state: 'cancel', createDate: '2026-07-13', salespersonId: 17, salespersonName: 'Mert Demir', customerId: 105, customerName: 'Orion Care', amountTotal: '900' }),
  record({ id: 4106, state: 'sale', createDate: '2026-07-16', dateOrder: '2026-07-29', salespersonId: 18, salespersonName: 'Selin Kaya', customerId: 101, customerName: 'Atlas Medical', amountTotal: '3100' }),
  record({ id: 4107, state: 'sent', createDate: '2026-07-19', salespersonId: 18, salespersonName: 'Selin Kaya', customerId: 102, customerName: 'Northstar Health', amountTotal: '2750' }),
  record({ id: 4108, state: 'sale', createDate: '2026-07-22', dateOrder: '2026-07-21', salespersonId: 18, salespersonName: 'Selin Kaya', customerId: 106, customerName: 'Helix Medical', amountTotal: '1600', currencyCode: 'EUR' }),
  record({ id: 4001, state: 'sale', createDate: '2026-06-03', dateOrder: '2026-06-08', salespersonId: 10, salespersonName: 'Ecem Aygül', customerId: 101, customerName: 'Atlas Medical', amountTotal: '1500' }),
  record({ id: 4002, state: 'draft', createDate: '2026-06-09', salespersonId: 17, salespersonName: 'Mert Demir', customerId: 104, customerName: 'Nova Surgical', amountTotal: '2100' }),
  record({ id: 4003, state: 'sale', createDate: '2026-06-14', dateOrder: '2026-07-02', salespersonId: 18, salespersonName: 'Selin Kaya', customerId: 102, customerName: 'Northstar Health', amountTotal: '1900' }),
  record({ id: 3901, state: 'sale', createDate: '2026-05-05', dateOrder: '2026-05-06', salespersonId: 10, salespersonName: 'Ecem Aygül', customerId: 103, customerName: 'Medline Europe', amountTotal: '1700', currencyCode: 'EUR' }),
  record({ id: 3801, state: 'draft', createDate: '2026-04-11', salespersonId: 17, salespersonName: 'Mert Demir', customerId: 105, customerName: 'Orion Care', amountTotal: '800' }),
  record({ id: 3701, state: 'sale', createDate: '2026-03-18', dateOrder: '2026-04-04', salespersonId: 18, salespersonName: 'Selin Kaya', customerId: 106, customerName: 'Helix Medical', amountTotal: '2300' }),
  record({ id: 3601, state: 'sale', createDate: '2026-02-21', dateOrder: '2026-02-21', salespersonId: 10, salespersonName: 'Ecem Aygül', customerId: 101, customerName: 'Atlas Medical', amountTotal: '1250' }),
];

export function getDemoQuotationConversionReport(
  filters: QuotationConversionFilters,
  generatedAt: Date,
): QuotationConversionReportResult {
  return buildQuotationConversionReport({
    records,
    filters,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [businessUnit.id],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
    detailLimit: 500,
  });
}
