// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL || 'http://127.0.0.1:3000';
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    // Default 5s is tight on a shared/contended host (e.g. this VPS also
    // running the live production stack and other concurrent processes);
    // assertions still fail on real bugs, they just get more time to
    // succeed on a slow box.
    timeout: 45000,
  },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 20000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseURL ? undefined : {
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
