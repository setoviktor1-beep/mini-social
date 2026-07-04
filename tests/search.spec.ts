import { test, expect } from '@playwright/test';

test.describe('Search Page E2E Tests', () => {
  test('should display initial search state', async ({ page }) => {
    await page.goto('/search');

    // Verify header and input presence
    await expect(page.locator('h1', { hasText: 'Search' })).toBeVisible();
    const searchInput = page.getByPlaceholder('Search users or posts...');
    await expect(searchInput).toBeVisible();

    // Verify initial "no query" placeholder state
    await expect(page.locator('text=Search for users or posts')).toBeVisible();
    await expect(page.locator('text=Type something above to get started')).toBeVisible();
  });

  test('should show empty state when search returns no results', async ({ page }) => {
    await page.goto('/search');

    // Type a query in search input
    const searchInput = page.getByPlaceholder('Search users or posts...');
    await searchInput.fill('nonexistentuser123');

    // Verify the empty state shows up
    await expect(page.locator('text=No results found')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Try a different search term')).toBeVisible();
  });

  test('should allow switching between Users and Posts tabs', async ({ page }) => {
    await page.goto('/search');

    // Locate the tabs
    const usersTab = page.getByRole('button', { name: 'Users' });
    const postsTab = page.getByRole('button', { name: 'Posts' });

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
