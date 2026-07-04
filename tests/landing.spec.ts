import { test, expect } from '@playwright/test';

test.describe('Landing Page E2E Tests', () => {
  test('should load the landing page successfully', async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/');

    // Check that the main content or signup reminder is visible
    const signupReminder = page.locator('text=Sign in to join the conversation.');
    await expect(signupReminder).toBeVisible();
  });

  test('should display sidebar navigation links', async ({ page }) => {
    await page.goto('/');

    // Verify presence of sidebar navigation links
    const homeLink = page.locator('aside nav').getByRole('link', { name: 'Home' });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');

    const servicesLink = page.locator('aside nav').getByRole('link', { name: 'Paslaugos' });
    await expect(servicesLink).toBeVisible();
    await expect(servicesLink).toHaveAttribute('href', '/services');

    const businessLink = page.locator('aside nav').getByRole('link', { name: 'Verslo Darbalaukis' });
    await expect(businessLink).toBeVisible();
    await expect(businessLink).toHaveAttribute('href', '/pricing');
  });

  test('should display trending tags fallback when no posts exist', async ({ page }) => {
    await page.goto('/');

    // Verify trending tags section header
    const trendingHeader = page.locator('text=Trending');
    await expect(trendingHeader).toBeVisible();

    // Verify presence of fallback tags
    await expect(page.locator('text=#minisocial')).toBeVisible();
    await expect(page.locator('text=#community')).toBeVisible();
    await expect(page.locator('text=#updates')).toBeVisible();
    await expect(page.locator('text=#discover')).toBeVisible();
  });
});
