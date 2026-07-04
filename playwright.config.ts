// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: false, // Ensure it always restarts with the correct env vars
    timeout: 60000,
    env: {
      STRIPE_PRICE_BASIC: 'price_basic_placeholder',
      STRIPE_PRICE_PRO: 'price_pro_placeholder',
      STRIPE_PRICE_ENTERPRISE: 'price_enterprise_placeholder',
    },
  },
});
