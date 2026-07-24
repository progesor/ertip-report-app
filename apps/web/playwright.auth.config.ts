import { defineConfig, devices } from '@playwright/test';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://ertip:ertip@127.0.0.1:5432/ertip_report';

export default defineConfig({
  testDir: './tests',
  testMatch: 'auth.smoke.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-auth',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @ertip/web start --port 3001',
    url: 'http://127.0.0.1:3001/api/health/live',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_ENV: 'test',
      APP_DEMO_MODE: 'false',
      DATABASE_URL: databaseUrl,
      DATABASE_SSL: 'false',
      SESSION_SECRET: 'browser-auth-session-secret-value-2026',
      SESSION_TTL_HOURS: '12',
      OWNER_BOOTSTRAP_TOKEN: 'browser-owner-bootstrap-token-2026',
      ODOO_BASE_URL: 'https://ertipmedical.odoo.com',
      ODOO_DATABASE: 'ertipmedical',
      ODOO_API_KEY: '',
    },
  },
});
