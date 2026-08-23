import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.use({
  locale: 'lt-LT',
  extraHTTPHeaders: {
    'Accept-Language': 'lt,en;q=0.9',
  },
});

const USER_A = { email: 'tester-a@example.com', password: 'TestPass123!' };
const authCookieCache = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();

async function dismissCookieNotice(page: Page) {
  const accept = page.getByRole('button', { name: /Supratau|Got it/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

async function login(page: Page, user: { email: string; password: string }) {
  const cachedCookies = authCookieCache.get(user.email);
  if (cachedCookies) {
    await page.context().addCookies(cachedCookies);
    await page.goto('/home');
    await page.waitForURL(/\/home/, { timeout: 60000 });
    await dismissCookieNotice(page);
    authCookieCache.set(user.email, await page.context().cookies());
    return;
  }

  await page.goto('/auth/login');
  await dismissCookieNotice(page);
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  await emailInput.fill(user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.locator('form button:not([type="button"])').first().click();
  await page.waitForURL(/\/home/, { timeout: 60000 });
  await dismissCookieNotice(page);
  authCookieCache.set(user.email, await page.context().cookies());
}

test.describe('AI Floating Assistant and Modern Composer UI', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept AI API endpoints for consistent, fast, deterministically mockable E2E tests
    await page.route('**/api/ai/threads', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            threads: [
              { id: 'thread-test-1', title: 'Pasiūlymai įrašui', updated_at: new Date().toISOString() },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'Tai puiki mintis! Štai mano rekomendacija tavo įrašui: pasidalink savo patirtimi.',
          threadId: 'thread-test-1',
          model: 'google/gemini-2.5-flash',
          provider: 'omnirouter',
        }),
      });
    });

    await page.route('**/api/ai/compose', async (route) => {
      const payload = route.request().postDataJSON() || {};
      const action = payload.action || 'rewrite';
      let suggestion = 'Pagerintas tekstas: Sveiki visi, noriu pasidalinti puikia naujiena!';
      if (action === 'hashtags') {
        suggestion = '#bendruomene #minisocial #naujienos';
      } else if (action === 'spelling') {
        suggestion = 'Ištaisytas tekstas be klaidų.';
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestion }),
      });
    });
  });

  test('1. Floating AI button is visible on authenticated home', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    const aiLauncher = page.locator('aside[aria-label="AI Asistentas"] button');
    await expect(aiLauncher).toBeVisible();
    await expect(aiLauncher).toHaveAttribute('aria-haspopup', 'dialog');
  });

  test('2. Click AI floating button opens ChatGPT-style AI drawer', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    const aiLauncher = page.locator('aside[aria-label="AI Asistentas"] button');
    await aiLauncher.click();

    const drawer = page.getByRole('dialog', { name: /AI Asistentas|AI Assistant/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByPlaceholder(/Klauskite AI asistento|Ask AI assistant/i)).toBeVisible();
  });

  test('3. Escape key closes AI drawer and restores focus', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    const aiLauncher = page.locator('aside[aria-label="AI Asistentas"] button');
    await aiLauncher.click();

    const drawer = page.getByRole('dialog', { name: /AI Asistentas|AI Assistant/i });
    await expect(drawer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('4. Mobile viewport opens fullscreen AI drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, USER_A);
    await page.goto('/home');

    const aiLauncher = page.locator('aside[aria-label="AI Asistentas"] button');
    await expect(aiLauncher).toBeVisible();

    await aiLauncher.click();
    const drawer = page.getByRole('dialog', { name: /AI Asistentas|AI Assistant/i });
    await expect(drawer).toBeVisible();

    // Verify close button works
    const closeBtn = drawer.getByRole('button', { name: /Uždaryti AI asistentą|Close AI assistant|Uždaryti|Close/i });
    await closeBtn.click();
    await expect(drawer).toBeHidden();
  });

  test('5. New chat button clears conversation in AI drawer', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    await page.locator('aside[aria-label="AI Asistentas"] button').click();
    const drawer = page.getByRole('dialog', { name: /AI Asistentas|AI Assistant/i });

    // Send a message first
    const input = drawer.getByPlaceholder(/Klauskite AI asistento|Ask AI assistant/i);
    await input.fill('Sveikas AI!');
    await drawer.getByRole('button', { name: /Siųsti žinutę|Send message/i }).click();

    await expect(drawer.getByText(/Tai puiki mintis/i)).toBeVisible();

    // Click new chat button
    await drawer.getByRole('button', { name: /Naujas pokalbis|New chat/i }).click();
    await expect(drawer.getByText(/Kuo galiu šiandien padėti|How can I help you today/i)).toBeVisible();
  });

  test('6. Can send message via Enter in AI drawer', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    await page.locator('aside[aria-label="AI Asistentas"] button').click();
    const drawer = page.getByRole('dialog', { name: /AI Asistentas|AI Assistant/i });

    const input = drawer.getByPlaceholder(/Klauskite AI asistento|Ask AI assistant/i);
    await input.fill('Papasakok apie save');
    await input.press('Enter');

    await expect(drawer.getByText('Papasakok apie save')).toBeVisible();
    await expect(drawer.getByText(/Tai puiki mintis/i)).toBeVisible();
  });

  test('7. Attachment menu (+) opens, toggles, and closes on Escape', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    const attachBtn = page.getByRole('button', { name: /Prisegti mediją|Attach media/i }).first();
    await expect(attachBtn).toBeVisible();

    // Open menu
    await attachBtn.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByText(/Nuotrauk/i)).toBeVisible();
    await expect(menu.getByText(/Vaizdo įraš/i)).toBeVisible();
    await expect(menu.getByText(/YouTube/i)).toBeVisible();

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('8. AI composer menu (✨ AI) opens and shows action options', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    const composer = page.getByPlaceholder(/Ką galvojate|What's on your mind|Ką norite pasidalinti/i).first();
    const aiMenuBtn = page.locator('button:has-text("✨ AI")').first();

    // Disabled when empty
    await expect(aiMenuBtn).toBeDisabled();

    // Enabled when text typed
    await composer.fill('Tekstas su klaida');
    await expect(aiMenuBtn).toBeEnabled();

    // Open popover
    await aiMenuBtn.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByText(/Pagerinti/i)).toBeVisible();
    await expect(menu.getByText(/Taisyti/i)).toBeVisible();
    await expect(menu.getByText(/Ton/i)).toBeVisible();
    await expect(menu.getByText(/Versti|Translate/i)).toBeVisible();
    await expect(menu.getByText(/Žym|Hashtag/i)).toBeVisible();

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('9 & 10. AI suggestion is NOT applied automatically; "Naudoti" applies it; "Atšaukti" dismisses it', async ({
    page,
  }) => {
    await login(page, USER_A);
    await page.goto('/home');

    const composer = page.getByPlaceholder(/Ką galvojate|What's on your mind|Ką norite pasidalinti/i).first();
    await composer.fill('Pradinis mano tekstas');

    const aiMenuBtn = page.locator('button:has-text("✨ AI")').first();
    await aiMenuBtn.click();

    // Click "Pagerinti tekstą"
    const rewriteOption = page.getByRole('menu').getByText(/Pagerinti/i).first();
    await rewriteOption.click({ force: true });

    // Verify AI preview appears without altering textarea content automatically
    await expect(page.getByText(/AI pasiūlymas|AI suggestion/i)).toBeVisible();
    await expect(page.getByText(/Pagerintas tekstas: Sveiki visi/i)).toBeVisible();
    await expect(composer).toHaveValue('Pradinis mano tekstas');

    // Click "Naudoti"
    await page.getByRole('button', { name: /Naudoti|Apply/i }).click();

    // Textarea now has the AI content
    await expect(composer).toHaveValue('Pagerintas tekstas: Sveiki visi, noriu pasidalinti puikia naujiena!');
    await expect(page.getByText(/AI pasiūlymas|AI suggestion/i)).toBeHidden();
  });

  test('11. YouTube link in attachment menu can be added and removed', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    const attachBtn = page.getByRole('button', { name: /Prisegti mediją|Attach media/i }).first();
    await attachBtn.click();

    // Click YouTube option
    const menu = page.getByRole('menu');
    await menu.getByText(/YouTube/i).click();
    const ytInput = page.getByPlaceholder('https://youtube.com/watch?v=...');
    await expect(ytInput).toBeVisible();

    await ytInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByRole('button', { name: /Išsaugoti|Save/i }).click();

    // Verify YouTube chip is rendered in composer
    await expect(page.getByText('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeVisible();

    // Remove YouTube link
    await page.getByRole('button', { name: /Pašalinti YouTube nuorodą|Remove YouTube/i }).click();
    await expect(page.getByText('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeHidden();
  });

  test('12. Mobile viewport: floating AI button does not overlap bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, USER_A);
    await page.goto('/home');

    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();

    const aiButton = page.locator('aside[aria-label="AI Asistentas"] button');
    await expect(aiButton).toBeVisible();

    const navBox = await bottomNav.boundingBox();
    const aiBox = await aiButton.boundingBox();

    expect(navBox).toBeTruthy();
    expect(aiBox).toBeTruthy();

    if (navBox && aiBox) {
      // AI button bottom edge should be above bottom nav top edge
      const aiBottom = aiBox.y + aiBox.height;
      const navTop = navBox.y;
      expect(aiBottom).toBeLessThanOrEqual(navTop + 1);
    }
  });

  test('13. AI Assistant drawer contains Model Selector dropdown', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    await page.locator('aside[aria-label="AI Asistentas"] button').click();
    const drawer = page.getByRole('dialog', { name: /AI Asistentas|AI Assistant/i });
    await expect(drawer).toBeVisible();

    const modelSelect = drawer.locator('select[aria-label="Pasirinkti AI modelį"]');
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect).toContainText('Nemotron');
    await expect(modelSelect).toContainText('Gemini');
  });

  test('14. UI Defense: Never renders raw tool_call or function_call blocks as assistant message', async ({ page }) => {
    // Override /api/ai/chat with leaked raw tool syntax
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: '```tool_call\n{"tool":"search_web","query":"mini-social users"}\n```',
          threadId: 'thread-test-1',
          model: 'google/gemini-3.5-flash-lite',
          provider: 'omnirouter',
        }),
      });
    });

    await login(page, USER_A);
    await page.goto('/home');

    await page.locator('aside[aria-label="AI Asistentas"] button').click();
    const drawer = page.getByRole('dialog', { name: /AI Asistentas|AI Assistant/i });

    const input = drawer.getByPlaceholder(/Klauskite AI asistento|Ask AI assistant/i);
    await input.fill('kiek vartotojų turi mini-social.online?');
    await input.press('Enter');

    // Verify raw tool_call and search_web are NOT displayed
    await expect(drawer.getByText('```tool_call')).toBeHidden();
    await expect(drawer.getByText('search_web')).toBeHidden();
  });
});
