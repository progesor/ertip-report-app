import { mkdir, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('personnel performance supports directory, amount analysis, JSON, filters and XLSX', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Personel Performansı' })).toBeVisible();

  await page.goto('/reports/personnel-performance?q=Ecem');
  await expect(page.getByRole('heading', { name: 'Personel Performansı' })).toBeVisible();
  await expect(page.getByText('Ecem Aygül', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Performansı Aç' }).click();

  await expect(page).toHaveURL(/personnel-performance\/10/u);
  await expect(page.getByRole('heading', { name: 'Ecem Aygül' })).toBeVisible();
  await expect(page.getByText('Toplam Teklif', { exact: true })).toBeVisible();
  await expect(page.getByText('Gerçekleşen Satış', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Teklif ve Gerçekleşen Satış Tutarları' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aylık Eğilim' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Müşteri Performansı ve Yoğunluğu' })).toBeVisible();
  await expect(page.getByText('USD', { exact: true }).first()).toBeVisible();

  const statusFilter = page.getByLabel('Durum');
  await statusFilter.selectOption('realized');
  await page.getByRole('button', { name: 'Raporu Çalıştır' }).click();
  await expect(page).toHaveURL(/status=realized/u);
  await expect(statusFilter).toHaveValue('realized');

  const response = await request.get(
    '/api/reports/personnel-performance/10?dateFrom=2026-02-01&dateTo=2026-08-01',
  );
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    readonly ok: boolean;
    readonly result: {
      readonly salesperson: { readonly id: number };
      readonly metrics: { readonly quotationCount: number; readonly realizedCount: number };
      readonly currencies: readonly {
        readonly currencyCode: string;
        readonly current: { readonly quotationAmount: string; readonly realizedAmount: string };
      }[];
      readonly scope: { readonly serverEnforced: boolean };
    };
  };
  expect(payload.ok).toBeTruthy();
  expect(payload.result.salesperson.id).toBe(10);
  expect(payload.result.metrics.quotationCount).toBeGreaterThan(0);
  expect(payload.result.metrics.realizedCount).toBeGreaterThan(0);
  const currencyCodes = payload.result.currencies.map(({ currencyCode }) => currencyCode);
  expect(currencyCodes).toContain('USD');
  expect(currencyCodes).toContain('EUR');
  expect(new Set(currencyCodes).size).toBe(currencyCodes.length);
  expect('mixedCurrencyTotal' in payload.result).toBe(false);
  expect(payload.result.scope.serverEnforced).toBe(true);

  const xlsx = await request.get(
    '/api/reports/personnel-performance/10/export?format=xlsx&dateFrom=2026-02-01&dateTo=2026-08-01',
  );
  expect(xlsx.ok()).toBeTruthy();
  expect(xlsx.headers()['content-type']).toContain(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const xlsxBody = await xlsx.body();
  expect(xlsxBody.subarray(0, 2).toString('ascii')).toBe('PK');
  await mkdir('test-results/report-export-previews', { recursive: true });
  await writeFile('test-results/report-export-previews/personnel-performance.xlsx', xlsxBody);
});
