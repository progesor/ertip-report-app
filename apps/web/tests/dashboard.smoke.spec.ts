import { mkdir, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('dashboard renders and owner/manager surfaces remain distinct', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Aylık Teklif Performansı' })).toBeVisible();
  await expect(page.getByText('Toplam Teklif')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Odoo Bağlantısı' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Raporu Aç' })).toBeVisible();

  await page.getByRole('button', { name: 'Manager' }).click();
  await expect(page.getByRole('button', { name: 'Odoo Bağlantısı' })).toHaveCount(0);
  await expect(page.getByText('Personel Karşılaştırması')).toBeVisible();
});

test('monthly quotation report renders filters, KPI, charts, views and drill-down', async ({ page, request }) => {
  await page.goto('/reports/monthly-quotation-performance?dateFrom=2026-07-01&dateTo=2026-08-01');

  await expect(page.getByRole('heading', { name: 'Aylık Teklif Performansı' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Raporu Çalıştır' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel İndir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tüm Personel PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seçili Personel PDF' })).toBeDisabled();
  await expect(
    page.locator('.report-kpi-grid').getByText('Dönüşüm Oranı', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teklif Üretimi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personel Karşılaştırması' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Müşteri Teklif Özeti' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teklif Detayı' })).toBeVisible();

  await page.getByRole('link', { name: 'Personel' }).click();
  await expect(page).toHaveURL(/view=salesperson/u);
  await expect(page.getByRole('heading', { name: 'Personel Karşılaştırması' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Müşteri Teklif Özeti' })).toHaveCount(0);

  const response = await request.get(
    '/api/reports/monthly-quotation-performance?dateFrom=2026-07-01&dateTo=2026-08-01',
  );
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    readonly ok: boolean;
    readonly result: {
      readonly metrics: { readonly quotationCount: number };
      readonly salespeople: readonly { readonly salespersonId: number | null }[];
    };
  };
  expect(payload.ok).toBeTruthy();
  expect(payload.result.metrics.quotationCount).toBeGreaterThan(0);

  const salespersonId = payload.result.salespeople.find(
    ({ salespersonId: candidate }) => candidate !== null,
  )?.salespersonId;
  expect(salespersonId).not.toBeNull();
  expect(salespersonId).not.toBeUndefined();

  const xlsx = await request.get(
    '/api/reports/monthly-quotation-performance/export?format=xlsx&dateFrom=2026-07-01&dateTo=2026-08-01',
  );
  expect(xlsx.ok()).toBeTruthy();
  expect(xlsx.headers()['content-type']).toContain(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  expect((await xlsx.body()).subarray(0, 2).toString('ascii')).toBe('PK');

  const teamPdf = await request.get(
    '/api/reports/monthly-quotation-performance/export?format=pdf&scope=all&dateFrom=2026-07-01&dateTo=2026-08-01',
  );
  expect(teamPdf.ok()).toBeTruthy();
  expect(teamPdf.headers()['content-type']).toContain('application/pdf');
  const teamPdfBody = await teamPdf.body();
  expect(teamPdfBody.subarray(0, 5).toString('ascii')).toBe('%PDF-');

  const personPdf = await request.get(
    `/api/reports/monthly-quotation-performance/export?format=pdf&scope=salesperson&dateFrom=2026-07-01&dateTo=2026-08-01&salespersonId=${salespersonId}`,
  );
  expect(personPdf.ok()).toBeTruthy();
  expect(personPdf.headers()['content-type']).toContain('application/pdf');
  const personPdfBody = await personPdf.body();
  expect(personPdfBody.subarray(0, 5).toString('ascii')).toBe('%PDF-');

  await mkdir('test-results/report-export-previews', { recursive: true });
  await Promise.all([
    writeFile('test-results/report-export-previews/team.pdf', teamPdfBody),
    writeFile('test-results/report-export-previews/person.pdf', personPdfBody),
  ]);
});

test('health and safe status endpoints expose no secret values', async ({ request }) => {
  const live = await request.get('/api/health/live');
  expect(live.ok()).toBeTruthy();

  const status = await request.get('/api/system/status');
  expect(status.ok()).toBeTruthy();
  const body = await status.text();
  expect(body).not.toContain('Authorization');
  expect(body).not.toContain('ODOO_API_KEY');
  expect(body).not.toContain('integration-secret');
});
