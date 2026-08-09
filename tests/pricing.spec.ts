import { test, expect } from '@playwright/test';

test.describe('Pricing Page E2E Tests', () => {
  test('should display pricing tiers and FAQ', async ({ page }) => {
    // Navigate to pricing page
    await page.goto('/pricing');

    // Verify main header
    const mainHeader = page.locator('h1', { hasText: 'Verslo planai' });
    await expect(mainHeader).toBeVisible();

    // Verify plan names
    await expect(page.locator('h2', { hasText: 'Basic' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Pro' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Enterprise' })).toBeVisible();

    // Verify plan prices using exact match to avoid matching description text
    await expect(page.getByText('14.99', { exact: true })).toBeVisible();
    await expect(page.getByText('29.99', { exact: true })).toBeVisible();
    await expect(page.getByText('89.99', { exact: true })).toBeVisible();

    // Verify FAQ exists
    await expect(page.locator('text=D.U.K.')).toBeVisible();
    await expect(page.locator('text=Ar galiu atšaukti bet kada?')).toBeVisible();
  });

  test('should redirect unauthenticated user to login when attempting to subscribe', async ({ page }) => {
    await page.goto('/pricing');

    // Click on the Basic plan start button
    const basicCta = page.locator('div', { has: page.locator('h2', { hasText: 'Basic' }) })
      .getByRole('button', { name: 'Pradėti' });
    
    await basicCta.click();

    // Verify redirection to the login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
