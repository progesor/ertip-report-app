import { expect, test } from '@playwright/test';

const ownerEmail = 'owner.browser@ertipmedical.com';
const ownerPassword = 'BrowserOwnerPassword2026';

test('first Owner can bootstrap, reject invalid login and log back in', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'İlk Owner hesabını oluşturun' })).toBeVisible();
  await page.getByLabel('Ad Soyad').fill('Browser Test Owner');
  await page.getByLabel('E-posta').fill(ownerEmail);
  await page.getByLabel('Parola').fill(ownerPassword);
  await page.getByLabel('Owner Bootstrap Token').fill('browser-owner-bootstrap-token-2026');
  await page.getByRole('button', { name: 'Owner Hesabını Oluştur' }).click();

  await expect(page.getByRole('heading', { name: 'Aylık Teklif Performansı' })).toBeVisible();
  await expect(page.getByText('Browser Test Owner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Odoo Bağlantısını Test Et' })).toBeDisabled();

  const statusResponse = await request.get('/api/system/status');
  expect(statusResponse.ok()).toBeTruthy();
  const status = (await statusResponse.json()) as {
    readonly database?: { readonly reachable?: boolean; readonly userCount?: number };
    readonly authentication?: { readonly configured?: boolean };
  };
  expect(status.database?.reachable).toBe(true);
  expect(status.database?.userCount).toBe(1);
  expect(status.authentication?.configured).toBe(true);

  await page.getByRole('button', { name: 'Çıkış' }).click();
  await expect(page.getByRole('heading', { name: 'Yönetici girişi' })).toBeVisible();

  await page.getByLabel('E-posta').fill('unknown@example.com');
  await page.getByLabel('Parola').fill('IncorrectPassword2026');
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page.locator('.form-error')).toHaveText('E-posta veya parola doğrulanamadı.');

  await page.getByLabel('E-posta').fill(ownerEmail);
  await page.getByLabel('Parola').fill(ownerPassword);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();

  await expect(page.getByRole('heading', { name: 'Aylık Teklif Performansı' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Odoo Bağlantısı', exact: true }),
  ).toBeVisible();
});
