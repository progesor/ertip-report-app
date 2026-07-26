import { mkdir, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('quotation conversion supports cohort timing, filters, JSON and XLSX', async ({
  page,
  request,
}) => {
  await page.goto('/reports');
  const conversionCard = page
    .getByRole('heading', { name: 'Tekliften Siparişe Dönüşüm', exact: true })
    .locator('..')
    .locator('..');
  await conversionCard.getByRole('link', { name: /Raporu Aç/u }).click();

  await expect(page).toHaveURL(/reports\/quotation-conversion/u);
  await expect(page.getByRole('heading', { name: 'Tekliften Siparişe Dönüşüm' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Teklif kohortlarının satışa dönüşme hızı' }),
  ).toBeVisible();
  await expect(page.getByText('Siparişe Dönüşen', { exact: true })).toBeVisible();
  await expect(page.getByText('Medyan Dönüşüm', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gecikme Günleri Dağılımı' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gerçekleşme Tarihi Anomalileri' })).toBeVisible();
  await expect(page.getByText('Kaynak anomalisi', { exact: true }).first()).toBeVisible();

  const salespersonFilter = page.getByLabel('Personel');
  await salespersonFilter.selectOption('10');
  await page.getByRole('button', { name: 'Raporu Çalıştır' }).click();
  await expect(page).toHaveURL(/salespersonId=10/u);
  await expect(salespersonFilter).toHaveValue('10');

  const response = await request.get(
    '/api/reports/quotation-conversion?dateFrom=2026-07-01&dateTo=2026-08-01',
  );
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    readonly ok: boolean;
    readonly result: {
      readonly definition: { readonly code: string; readonly dateAxis: string };
      readonly metrics: {
        readonly quotationCount: number;
        readonly convertedCount: number;
        readonly sameMonthConvertedCount: number;
        readonly crossMonthConvertedCount: number;
        readonly anomalyCount: number;
        readonly medianLagDays: number | null;
      };
      readonly anomalies: { readonly confirmationBeforeQuotationCount: number };
      readonly lagDistribution: readonly { readonly code: string; readonly count: number }[];
      readonly scope: { readonly serverEnforced: boolean };
    };
  };
  expect(payload.ok).toBeTruthy();
  expect(payload.result.definition.code).toBe('quotation-to-order-conversion');
  expect(payload.result.definition.dateAxis).toContain('create_date');
  expect(payload.result.definition.dateAxis).toContain('date_order');
  expect(payload.result.metrics.quotationCount).toBeGreaterThan(0);
  expect(payload.result.metrics.convertedCount).toBeGreaterThan(0);
  expect(payload.result.metrics.sameMonthConvertedCount).toBeGreaterThan(0);
  expect(payload.result.metrics.crossMonthConvertedCount).toBeGreaterThan(0);
  expect(payload.result.metrics.anomalyCount).toBeGreaterThan(0);
  expect(payload.result.metrics.medianLagDays).not.toBeNull();
  expect(payload.result.anomalies.confirmationBeforeQuotationCount).toBeGreaterThan(0);
  expect(payload.result.lagDistribution.some(({ code, count }) => code === 'anomaly' && count > 0)).toBe(true);
  expect(payload.result.scope.serverEnforced).toBe(true);

  const xlsx = await request.get(
    '/api/reports/quotation-conversion/export?format=xlsx&dateFrom=2026-07-01&dateTo=2026-08-01',
  );
  expect(xlsx.ok()).toBeTruthy();
  expect(xlsx.headers()['content-type']).toContain(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const xlsxBody = await xlsx.body();
  expect(xlsxBody.subarray(0, 2).toString('ascii')).toBe('PK');
  await mkdir('test-results/report-export-previews', { recursive: true });
  await writeFile('test-results/report-export-previews/quotation-conversion.xlsx', xlsxBody);
});
