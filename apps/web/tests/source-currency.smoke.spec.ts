import { mkdir, writeFile } from 'node:fs/promises';

import { expect, test, type APIRequestContext } from '@playwright/test';

interface AmountRow {
  readonly currencyCode: string;
}

async function assertXlsx(
  request: APIRequestContext,
  path: string,
  filename: string,
): Promise<void> {
  const response = await request.get(path);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-type']).toContain(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const body = await response.body();
  expect(body.subarray(0, 2).toString('ascii')).toBe('PK');
  await mkdir('test-results/report-export-previews', { recursive: true });
  await writeFile(`test-results/report-export-previews/${filename}`, body);
}

test('monthly report exposes separated source-currency amounts inline, in JSON and XLSX', async ({
  page,
  request,
}) => {
  await page.goto(
    '/reports/monthly-quotation-performance?dateFrom=2026-07-01&dateTo=2026-08-01',
  );
  await expect(page.getByTestId('source-currency-comparison')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teklif ve Gerçekleşen Satış Tutarları' })).toBeVisible();
  await expect(page.getByText('USD', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('EUR', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Ana navigasyon' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Rapor navigasyonu' })).toBeHidden();

  const response = await request.get(
    '/api/reports/monthly-quotation-performance?dateFrom=2026-07-01&dateTo=2026-08-01',
  );
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    readonly result: { readonly amounts: readonly AmountRow[] };
  };
  const currencyCodes = payload.result.amounts.map(({ currencyCode }) => currencyCode);
  expect(currencyCodes).toContain('USD');
  expect(currencyCodes).toContain('EUR');
  expect(new Set(currencyCodes).size).toBe(currencyCodes.length);
  expect('mixedCurrencyTotal' in payload.result).toBe(false);

  await assertXlsx(
    request,
    '/api/reports/monthly-quotation-performance/export?format=xlsx&dateFrom=2026-07-01&dateTo=2026-08-01',
    'monthly-source-currency.xlsx',
  );
});

test('open aging and customer history expose operational source-currency amounts inline', async ({
  page,
  request,
}) => {
  await page.goto('/reports/open-aging-quotations');
  await expect(page.getByTestId('source-currency-amounts')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Açık ve Yaşlanan Teklif Tutarları' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Ana navigasyon' })).toBeVisible();

  const openResponse = await request.get('/api/reports/open-aging-quotations');
  expect(openResponse.ok()).toBeTruthy();
  const openPayload = (await openResponse.json()) as {
    readonly result: { readonly amounts: readonly AmountRow[] };
  };
  expect(openPayload.result.amounts.length).toBeGreaterThan(0);
  expect('mixedCurrencyTotal' in openPayload.result).toBe(false);
  await assertXlsx(
    request,
    '/api/reports/open-aging-quotations/export?format=xlsx',
    'open-aging-source-currency.xlsx',
  );

  await page.goto(
    '/reports/customer-quotation-history/101?dateFrom=2026-02-01&dateTo=2026-08-01',
  );
  await expect(page.getByTestId('source-currency-amounts')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teklif ve Gerçekleşen Satış Tutarları' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Ana navigasyon' })).toBeVisible();

  const customerResponse = await request.get(
    '/api/reports/customer-quotation-history/101?dateFrom=2026-02-01&dateTo=2026-08-01',
  );
  expect(customerResponse.ok()).toBeTruthy();
  const customerPayload = (await customerResponse.json()) as {
    readonly result: { readonly amounts: readonly AmountRow[] };
  };
  expect(customerPayload.result.amounts.length).toBeGreaterThan(0);
  expect('mixedCurrencyTotal' in customerPayload.result).toBe(false);
  await assertXlsx(
    request,
    '/api/reports/customer-quotation-history/101/export?format=xlsx&dateFrom=2026-02-01&dateTo=2026-08-01',
    'customer-history-source-currency.xlsx',
  );
});
