import { test, expect } from '@playwright/test';

test.describe('Landing Page E2E Tests', () => {
  test('should load the landing page successfully', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Bendrauk paprastai/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sukurti paskyrą nemokamai/ })).toHaveAttribute('href', '/auth/register');
    await expect(page.locator('main').getByRole('link', { name: 'Prisijungti' })).toHaveAttribute('href', '/auth/login');
  });

  test('should display core product features', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Srautas ir diskusijos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Privačios žinutės realiu laiku' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Paslaugų erdvė' })).toBeVisible();
  });

  test('should display the FAQ', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dažniausi klausimai' })).toBeVisible();
    await expect(page.getByText('Ar „Mini Social“ nemokamas?')).toBeVisible();
  });
});
