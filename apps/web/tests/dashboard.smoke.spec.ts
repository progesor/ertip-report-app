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
  await expect(page.getByText('Dönüşüm Oranı')).toBeVisible();
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
    readonly result: { readonly metrics: { readonly quotationCount: number } };
  };
  expect(payload.ok).toBeTruthy();
  expect(payload.result.metrics.quotationCount).toBeGreaterThan(0);
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
