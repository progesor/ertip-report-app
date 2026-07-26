import { expect, test } from '@playwright/test';

const ownerEmail = 'owner.browser@ertipmedical.com';
const ownerPassword = 'BrowserOwnerPassword2026';

test('first Owner can bootstrap, enforce report auth, export and log back in', async ({ page, request }) => {
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
  await expect(page.getByRole('link', { name: 'Açık ve Yaşlanan Teklifler' })).toBeVisible();

  const statusResponse = await request.get('/api/system/status');
  expect(statusResponse.ok()).toBeTruthy();
  const status = (await statusResponse.json()) as {
    readonly database?: { readonly reachable?: boolean; readonly userCount?: number };
    readonly authentication?: { readonly configured?: boolean };
  };
  expect(status.database?.reachable).toBe(true);
  expect(status.database?.userCount).toBe(1);
  expect(status.authentication?.configured).toBe(true);

  const reportResponse = await page.request.get('/api/reports/open-aging-quotations');
  expect(reportResponse.ok()).toBeTruthy();
  const exportResponse = await page.request.get(
    '/api/reports/open-aging-quotations/export?format=xlsx',
  );
  expect(exportResponse.ok()).toBeTruthy();
  expect(exportResponse.headers()['content-type']).toContain(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  const auditResponse = await page.request.get('/api/owner/audit-logs');
  expect(auditResponse.ok()).toBeTruthy();
  const audit = (await auditResponse.json()) as {
    readonly events: readonly {
      readonly action: string;
      readonly entityId: string | null;
      readonly metadata: Readonly<Record<string, unknown>>;
    }[];
  };
  const exportEvent = audit.events.find(
    ({ action, entityId }) => action === 'report.export.xlsx' && entityId === 'open-aging-quotations',
  );
  expect(exportEvent).toBeDefined();
  expect(exportEvent?.metadata.format).toBe('xlsx');
  expect('customerName' in (exportEvent?.metadata ?? {})).toBe(false);
  expect('amountTotal' in (exportEvent?.metadata ?? {})).toBe(false);

  await page.getByRole('button', { name: 'Çıkış' }).click();
  await expect(page.getByRole('heading', { name: 'Yönetici girişi' })).toBeVisible();

  const unauthorizedReport = await page.request.get('/api/reports/open-aging-quotations');
  expect(unauthorizedReport.status()).toBe(401);

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
