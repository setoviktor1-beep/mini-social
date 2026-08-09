import { test, expect } from '@playwright/test';

test.describe('Search Page E2E Tests', () => {
  test('should display initial search state', async ({ page }) => {
    await page.goto('/search');

    // Verify header and input presence
    await expect(page.locator('h1', { hasText: 'Paieška' })).toBeVisible();
    const searchInput = page.getByPlaceholder('Ieškokite žmonių arba įrašų...');
    await expect(searchInput).toBeVisible();

    // Verify initial "no query" placeholder state
    await expect(page.getByText('Raskite žmones arba įrašus')).toBeVisible();
    await expect(page.getByText('Pradėkite rašyti paieškos laukelyje')).toBeVisible();
  });

  test('should show empty state when search returns no results', async ({ page }) => {
    await page.goto('/search');

    // Type a query in search input
    const searchInput = page.getByPlaceholder('Ieškokite žmonių arba įrašų...');
    await searchInput.fill('nonexistentuser123');

    // Verify the empty state shows up
    await expect(page.getByText('Nieko nerasta')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Pabandykite kitą paieškos frazę')).toBeVisible();
  });

  test('should allow switching between Users and Posts tabs', async ({ page }) => {
    await page.goto('/search');

    // Locate the tabs
    const usersTab = page.getByRole('button', { name: 'Žmonės' });
    const postsTab = page.getByRole('button', { name: 'Įrašai' });

    await expect(usersTab).toBeVisible();
    await expect(postsTab).toBeVisible();

    // Switch to Posts tab and verify
    await postsTab.click();
    await expect(postsTab).toHaveClass(/bg-blue-600/);

    // Switch back to Users tab
    await usersTab.click();
    await expect(usersTab).toHaveClass(/bg-blue-600/);
  });
});
