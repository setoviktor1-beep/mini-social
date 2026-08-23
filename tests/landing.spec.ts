import { test, expect } from '@playwright/test';

test.use({
  locale: 'lt-LT',
  extraHTTPHeaders: {
    'Accept-Language': 'lt,en;q=0.9',
  },
});

test.describe('Landing Page E2E Tests', () => {
  test('should load the landing page successfully', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Bendrauk paprastai|Connect simply/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sukurti paskyrą|Create account/i })).toHaveAttribute('href', '/auth/register');
    await expect(page.locator('main').getByRole('link', { name: /Prisijungti|Sign in|Log in/i })).toHaveAttribute('href', '/auth/login');
  });

  test('should display core product features', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Srautas ir diskusijos|Feed and discussions/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Privačios žinutės|Direct messaging/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Paslaugų erdvė|Services hub/i })).toBeVisible();
  });

  test('should display the FAQ', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Dažniausi klausimai|Frequently asked questions/i })).toBeVisible();
    await expect(page.getByText(/Ar „Mini Social“ nemokamas\?|Is Mini Social free\?/i)).toBeVisible();
  });
});
