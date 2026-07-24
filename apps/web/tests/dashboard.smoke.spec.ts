import { expect, test } from '@playwright/test';

test('dashboard renders and owner/manager surfaces remain distinct', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Aylık Teklif Performansı' })).toBeVisible();
  await expect(page.getByText('Toplam Teklif')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Odoo Bağlantısı' })).toBeVisible();

  await page.getByRole('button', { name: 'Manager' }).click();
  await expect(page.getByRole('button', { name: 'Odoo Bağlantısı' })).toHaveCount(0);
  await expect(page.getByText('Personel Karşılaştırması')).toBeVisible();
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
