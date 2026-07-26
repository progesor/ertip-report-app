import { expect, test } from '@playwright/test';

const reportNames = [
  'Aylık Teklif Performansı',
  'Tekliften Siparişe Dönüşüm',
  'Müşteri Teklif Geçmişi',
  'Personel Performansı',
  'Açık ve Yaşlanan Teklifler',
] as const;

test('central report library exposes every accepted report through persistent navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Raporlar', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Raporlar', exact: true }).click();

  await expect(page).toHaveURL('/reports');
  await expect(page.getByRole('heading', { name: 'Raporlar', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Karar vermek için gereken görünümü seçin.' }),
  ).toBeVisible();
  await expect(page.getByText('5', { exact: true })).toBeVisible();

  for (const reportName of reportNames) {
    await expect(page.getByRole('heading', { name: reportName, exact: true })).toBeVisible();
  }

  const reportActions = page.getByRole('link', { name: /Raporu Aç/u });
  await expect(reportActions).toHaveCount(5);
});

test('report library card preserves direct monthly report route', async ({ page }) => {
  await page.goto('/reports');
  const monthlyCard = page
    .getByRole('heading', { name: 'Aylık Teklif Performansı', exact: true })
    .locator('..')
    .locator('..');
  await monthlyCard.getByRole('link', { name: /Raporu Aç/u }).click();

  await expect(page).toHaveURL(/\/reports\/monthly-quotation-performance/u);
  await expect(page.getByRole('heading', { name: 'Aylık Teklif Performansı' })).toBeVisible();
});
