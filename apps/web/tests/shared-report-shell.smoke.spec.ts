import { expect, test } from '@playwright/test';

const reportRoutes = [
  {
    path: '/reports/monthly-quotation-performance?dateFrom=2026-07-01&dateTo=2026-08-01',
    heading: 'Aylık Teklif Performansı',
  },
  { path: '/reports/open-aging-quotations', heading: 'Açık ve Yaşlanan Teklifler' },
  {
    path: '/reports/customer-quotation-history/101?dateFrom=2026-02-01&dateTo=2026-08-01',
    heading: 'Atlas Hospital Group',
  },
  {
    path: '/reports/personnel-performance/10?dateFrom=2026-02-01&dateTo=2026-08-01',
    heading: 'Ecem Aygül',
  },
  {
    path: '/reports/quotation-conversion?dateFrom=2026-07-01&dateTo=2026-08-01',
    heading: 'Tekliften Siparişe Dönüşüm',
  },
] as const;

for (const report of reportRoutes) {
  test(`${report.heading} uses the shared workspace shell`, async ({ page }) => {
    await page.goto(report.path);

    await expect(page.getByRole('navigation', { name: 'Ana navigasyon' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Rapor konumu' })).toBeVisible();
    await expect(page.getByRole('heading', { name: report.heading, exact: true }).first()).toBeVisible();
    await expect(page.getByText('İş birimi', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Veri kaynağı', { exact: true }).first()).toBeVisible();
    await expect(page.locator('.report-sidebar')).toBeHidden();
    await expect(page.locator('.report-topbar')).toBeHidden();
    await expect(page.getByTestId('source-currency-drawer')).toHaveCount(0);
  });
}

test('customer and personnel directories use the shared workspace shell', async ({ page }) => {
  await page.goto('/reports/customer-quotation-history?q=Atlas');
  await expect(page.getByRole('navigation', { name: 'Ana navigasyon' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Müşteri Teklif Geçmişi', exact: true }).first()).toBeVisible();
  await expect(page.locator('.report-sidebar')).toBeHidden();

  await page.goto('/reports/personnel-performance?q=Ecem');
  await expect(page.getByRole('navigation', { name: 'Ana navigasyon' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personel Performansı', exact: true }).first()).toBeVisible();
  await expect(page.locator('.report-sidebar')).toBeHidden();
});
