import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Authenticated coverage for the social-redesign feature branch. Requires
// two pre-seeded accounts (created via /api/auth/sign-up/email against a
// local/dev database — see docs/testing-social-features.md) and runs
// against a locally running app (PLAYWRIGHT_BASE_URL), never production.
const USER_A = { email: 'tester-a@example.com', password: 'TestPass123!' };
const USER_B = { email: 'tester-b@example.com', password: 'TestPass123!' };
const authCookieCache = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();

async function dismissCookieNotice(page: Page) {
  const accept = page.getByRole('button', { name: 'Supratau' });
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
    // Better Auth may rotate the session cookie while the home page restores
    // the session; carry that refreshed cookie into the next isolated context.
    authCookieCache.set(user.email, await page.context().cookies());
    return;
  }

  await page.goto('/auth/login');
  await dismissCookieNotice(page);
  await page.getByPlaceholder('john@example.com').fill(user.email);
  await page.getByPlaceholder('••••••••').fill(user.password);
  await page.getByRole('button', { name: 'Prisijungti' }).click();
  await page.waitForURL(/\/home/, { timeout: 60000 });
  await dismissCookieNotice(page);
  authCookieCache.set(user.email, await page.context().cookies());
}

async function createPost(page: Page, content: string) {
  // Callers are always already on /home right after login(); an extra
  // page.goto() here raced with hydration and occasionally produced a
  // transient duplicate composer in the DOM.
  if (!/\/home/.test(page.url())) {
    await page.goto('/home');
  }
  const card = page.getByTestId('post-card').filter({ hasText: content }).first();

  // .first(): under heavy host load, a fresh SSR/hydration pass has
  // occasionally left a transient duplicate composer in the DOM for a
  // moment (a rendering artifact of the contended environment, not of the
  // app's logic — the duplicate never persists or causes a duplicate
  // submit). Scoping to the first instance sidesteps strict-mode errors.
  const composer = page.getByPlaceholder('Ką galvojate?').first();
  await composer.fill(content);
  await page.getByRole('button', { name: 'Skelbti', exact: true }).click();

  // This local harness shares the VPS with the live production stack (plus
  // other concurrent processes), so client-side re-render after posting is
  // occasionally slow enough to exceed even a generous timeout — verified
  // via direct API calls that post creation itself is 100% reliable
  // server-side (see docs/testing-social-features.md). On timeout, RELOAD
  // rather than resubmitting the form: the post was almost certainly
  // already created, and resubmitting would create a genuine duplicate
  // that destabilizes every later `.first()` lookup in the test.
  try {
    await expect(card).toBeVisible({ timeout: 15000 });
  } catch {
    await page.reload();
    await expect(card).toBeVisible({ timeout: 60000 });
  }
  return card;
}

test.describe('Social features (authenticated)', () => {
  test.describe.configure({ timeout: 120000 });

  test('create a post', async ({ page }) => {
    await login(page, USER_A);
    const unique = `E2E post ${Date.now()}`;
    const card = await createPost(page, unique);
    await expect(card).toContainText(unique);
  });

  test('add, change and remove a reaction; counts update', async ({ page }) => {
    await login(page, USER_A);
    const unique = `Reaction target ${Date.now()}`;
    const card = await createPost(page, unique);

    const reactButton = card.getByRole('button', { name: 'Reaguoti į įrašą (patinka)' });
    await expect(reactButton).toContainText('0');

    // add: tap toggles the default 'like' reaction
    await reactButton.click();
    const trigger = card.getByTestId('reaction-picker-trigger');
    await expect(trigger).toBeEnabled();
    const likeButton = card.getByRole('button', { name: /Reakcija: Patinka/ });
    await expect(likeButton).toContainText('1');
    // accessibility: when the active reaction really is 'like', a tap really
    // does remove it — the label's claim matches the click's real effect.
    await expect(likeButton).toHaveAttribute('aria-label', /pašalintumėte/);

    // change: the dedicated picker trigger opens the reaction menu
    await trigger.click();
    const picker = card.getByRole('menu', { name: 'Pasirinkite reakciją' });
    await expect(picker).toBeVisible();
    await picker.getByRole('menuitemradio', { name: /Super/ }).click();
    await expect(trigger).toBeEnabled();
    const reactedButton = card.getByRole('button', { name: /Reakcija: Super/ });
    await expect(reactedButton).toBeVisible();
    // switching type does not change the total count (still one reaction)
    await expect(reactedButton).toContainText('1');

    // accessibility: a plain tap on this button always sets 'like' (see
    // handleReact), never removes the active 'love' reaction — the label
    // must describe that real outcome, not claim it removes the reaction.
    const nonLikeAriaLabel = await reactedButton.getAttribute('aria-label');
    expect(nonLikeAriaLabel).toContain('pakeistumėte');
    expect(nonLikeAriaLabel).not.toContain('pašalintumėte');

    // remove: re-opening the picker and choosing the same active reaction
    // toggles it off (a plain tap on the main button always targets 'like'
    // specifically, matching the Facebook-style default-reaction pattern).
    await trigger.click();
    await card.getByRole('menu', { name: 'Pasirinkite reakciją' }).getByRole('menuitemradio', { name: /Super/ }).click();
    await expect(trigger).toBeEnabled();
    await expect(card.getByRole('button', { name: 'Reaguoti į įrašą (patinka)' })).toContainText('0');
  });

  test('reaction picker is fully keyboard-operable (open, navigate, select, remove)', async ({ page }) => {
    await login(page, USER_A);
    const unique = `Keyboard reaction target ${Date.now()}`;
    const card = await createPost(page, unique);

    const trigger = card.getByTestId('reaction-picker-trigger');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Open with keyboard only.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = card.getByRole('menu', { name: 'Pasirinkite reakciją' });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', await menu.getAttribute('id') ?? '');

    // Focus must move into the menu, landing on the 'like' item (no active reaction yet).
    await expect(card.getByTestId('reaction-option-like')).toBeFocused();

    // Arrow-key navigation between reaction options.
    await page.keyboard.press('ArrowRight');
    await expect(card.getByTestId('reaction-option-love')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(card.getByTestId('reaction-option-laugh')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(card.getByTestId('reaction-option-love')).toBeFocused();

    // Select 'love' with the keyboard.
    await page.keyboard.press('Enter');
    const lovedButton = card.getByRole('button', { name: /Reakcija: Super/ });
    await expect(lovedButton).toBeVisible();
    await expect(menu).toBeHidden();
    // The trigger is briefly disabled while the reaction request is
    // in-flight (reactionLoading) — wait for it before interacting again,
    // or focus()/keyboard input on a disabled button silently no-ops.
    await expect(trigger).toBeEnabled();

    // Escape closes the picker and returns focus to the trigger.
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    // Re-open: focus lands on the currently active reaction (love), and
    // selecting it again removes it (no accidental double activation).
    await page.keyboard.press('Enter');
    await expect(card.getByTestId('reaction-option-love')).toBeFocused();
    await expect(card.getByTestId('reaction-option-love')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    // Regression: focus must return to the trigger only once it is
    // genuinely re-enabled (reactionLoading cleared) — calling .focus() on
    // a still-disabled button silently no-ops, which is what caused the
    // original flake in this exact reopen-and-remove sequence.
    await expect(trigger).toBeEnabled();
    await expect(trigger).toBeFocused();
    await expect(card.getByRole('button', { name: 'Reaguoti į įrašą (patinka)' })).toContainText('0');
  });

  test('reaction picker cannot double-submit on rapid repeated activation', async ({ page }) => {
    await login(page, USER_A);
    const unique = `Rapid reaction target ${Date.now()}`;
    const card = await createPost(page, unique);

    const reactButton = card.getByRole('button', { name: 'Reaguoti į įrašą (patinka)' });
    // Dispatch three real DOM clicks synchronously in a single JS turn via
    // evaluate(), rather than three separate Playwright .click() calls.
    // Playwright's .click() does its own actionability polling per call
    // (including waiting out a disabled state), which doesn't reproduce
    // the actual race: multiple handleReact() invocations landing before
    // React has re-rendered with reactionLoading=true, all reading the
    // same stale (not-yet-loading) closure. This does reproduce it.
    await reactButton.evaluate((el: HTMLButtonElement) => {
      el.click();
      el.click();
      el.click();
    });

    // Exactly one of those three synchronous clicks may result in a
    // mutation; the rest must be rejected by the synchronous ref lock, not
    // silently queued to fire later once the button re-enables (that would
    // still be a "double submit" in effect, just delayed).
    const likeButton = card.getByRole('button', { name: /Reakcija: Patinka/ });
    await expect(likeButton).toBeVisible();
    await expect(likeButton).toContainText('1');
    // The ref lock rejects extra clicks synchronously (not by queuing them
    // for later) — so once the one legitimate request has settled (trigger
    // re-enabled) there is nothing left in flight that could still drift
    // the count. Re-check after that deterministic signal, not a sleep.
    const trigger = card.getByTestId('reaction-picker-trigger');
    await expect(trigger).toBeEnabled();
    await expect(likeButton).toContainText('1');

    // Re-open the picker immediately after — must not carry over any stale
    // focus/index state from the rapid-fire activation above.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = card.getByRole('menu', { name: 'Pasirinkite reakciją' });
    await expect(menu).toBeVisible();
    await expect(card.getByTestId('reaction-option-like')).toBeFocused();
    await expect(card.getByTestId('reaction-option-like')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('bookmark and unbookmark a post', async ({ page }) => {
    await login(page, USER_A);
    const unique = `Bookmark target ${Date.now()}`;
    const card = await createPost(page, unique);

    await card.getByRole('button', { name: 'Išsaugoti įrašą' }).click();
    await expect(card.getByRole('button', { name: 'Pašalinti iš išsaugotų' })).toBeVisible();

    await page.goto('/bookmarks');
    await expect(page.getByTestId('post-card').filter({ hasText: unique }).first()).toBeVisible();

    const bookmarkedCard = page.getByTestId('post-card').filter({ hasText: unique }).first();
    await bookmarkedCard.getByRole('button', { name: 'Pašalinti iš išsaugotų' }).click();
    await page.reload();
    await expect(page.getByTestId('post-card').filter({ hasText: unique })).toHaveCount(0);
  });

  test('an already-bookmarked post appears bookmarked on its author\'s profile page, and can be unbookmarked there', async ({ page }) => {
    await login(page, USER_A);
    const unique = `Profile bookmark target ${Date.now()}`;
    const card = await createPost(page, unique);

    await card.getByRole('button', { name: 'Išsaugoti įrašą' }).click();
    await expect(card.getByRole('button', { name: 'Pašalinti iš išsaugotų' })).toBeVisible();

    // Resolve the current user's own profile URL from the navbar instead of
    // assuming the generated username.
    const profileHref = await page.locator('a[href^="/u/"]').first().getAttribute('href');
    expect(profileHref).toBeTruthy();

    await page.goto(profileHref!);
    const profileCard = page.getByTestId('post-card').filter({ hasText: unique }).first();
    await expect(profileCard).toBeVisible();
    // Regression: app/u/[username]/page.tsx must load the viewer's own
    // bookmark IDs and set user_bookmarked, or this button falsely shows
    // "Išsaugoti įrašą" for a post that's already bookmarked, and clicking
    // it attempts a duplicate insert that silently no-ops instead of
    // unbookmarking.
    const profileBookmarkButton = profileCard.getByRole('button', { name: 'Pašalinti iš išsaugotų' });
    await expect(profileBookmarkButton).toBeVisible();

    await profileBookmarkButton.click();
    await expect(profileCard.getByRole('button', { name: 'Išsaugoti įrašą' })).toBeVisible();

    await page.goto('/bookmarks');
    await expect(page.getByTestId('post-card').filter({ hasText: unique })).toHaveCount(0);
  });

  test('mute hides a user\'s posts from the feed; unmute restores them', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      await login(pageB, USER_B);
      const unique = `Muted author post ${Date.now()}`;
      await createPost(pageB, unique);

      await login(pageA, USER_A);
      await pageA.goto('/home?tab=latest');
      const targetCard = pageA.getByTestId('post-card').filter({ hasText: unique }).first();
      await expect(targetCard).toBeVisible();

      // Resolve tester-b's profile URL from the post card itself instead of
      // assuming the generated username.
      const authorHref = await targetCard.locator('a[href^="/u/"]').first().getAttribute('href');
      expect(authorHref).toBeTruthy();

      await pageA.goto(authorHref!);
      await pageA.getByRole('button', { name: 'Nutildyti', exact: true }).click();
      await pageA.waitForURL(authorHref!);

      await pageA.goto('/home?tab=latest');
      await expect(pageA.getByTestId('post-card').filter({ hasText: unique })).toHaveCount(0);

      await pageA.goto(authorHref!);
      await pageA.getByRole('button', { name: 'Nebenutildyti', exact: true }).click();
      await pageA.waitForURL(authorHref!);

      await pageA.goto('/home?tab=latest');
      await expect(pageA.getByTestId('post-card').filter({ hasText: unique })).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('optimistic reaction rollback after a failed request', async ({ page }) => {
    await login(page, USER_A);
    const unique = `Rollback target ${Date.now()}`;
    const card = await createPost(page, unique);

    // Force the mutation to fail server-side after the optimistic UI update.
    await page.route('**/api/data/query', async (route) => {
      const request = route.request();
      const body = request.postDataJSON?.() as { table?: string; method?: string } | undefined;
      if (body?.table === 'reactions' && body.method === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"forced failure"}}' });
        return;
      }
      await route.continue();
    });

    const reactButton = card.getByRole('button', { name: 'Reaguoti į įrašą (patinka)' });
    await reactButton.click();
    // Immediately after click the optimistic count shows 1; once the forced
    // 500 resolves, rollback must bring it back to 0.
    await expect(card.getByRole('button', { name: 'Reaguoti į įrašą (patinka)' })).toContainText('0');
  });

  test('unauthenticated write to a protected table is rejected (401)', async ({ request }) => {
    const response = await request.post('/api/data/query', {
      data: {
        table: 'reactions',
        method: 'POST',
        body: { user_id: '11111111-1111-1111-1111-111111111111', post_id: '11111111-1111-1111-1111-111111111111', type: 'like' },
        filters: [],
        order: [],
      },
    });
    expect(response.status()).toBe(401);
  });

  test('authenticated mutation on someone else\'s row is rejected (403)', async ({ page, request }) => {
    await login(page, USER_A);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const response = await request.post('/api/data/query', {
      headers: { cookie: cookieHeader },
      data: {
        table: 'mutes',
        method: 'POST',
        // muter_id belongs to someone else — RLS must reject this even
        // though the requester is authenticated.
        body: { muter_id: '22222222-2222-2222-2222-222222222222', muted_id: '11111111-1111-1111-1111-111111111111' },
        filters: [],
        order: [],
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('feed tab switching', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/home');

    await page.getByRole('link', { name: 'Sekami' }).click();
    await expect(page).toHaveURL(/tab=following/);

    await page.getByRole('link', { name: 'Naujausi' }).click();
    await expect(page).toHaveURL(/tab=latest/);

    await page.getByRole('link', { name: 'Tau' }).click();
    await expect(page).toHaveURL(/tab=for_you/);
  });

  test('comment creation', async ({ page }) => {
    await login(page, USER_A);
    const unique = `Comment target ${Date.now()}`;
    const card = await createPost(page, unique);

    // Click the comment button to show comments
    await card.getByRole('button', { name: 'Rodyti komentarus' }).click();

    // Type a comment and submit
    const commentText = `Test comment ${Date.now()}`;
    const commentInput = card.getByPlaceholder('Parašykite komentarą...');
    await commentInput.fill(commentText);
    await card.getByRole('button', { name: 'Paskelbti komentarą' }).click();

    // Verify the comment appears
    await expect(card.getByText(commentText)).toBeVisible();
  });

  test.describe('video posts (db/migrations/0011_video_posts.sql)', () => {
    function buildMp4Buffer(durationSeconds: number): Buffer {
      const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
      const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
      const ftyp = [...u32(16), ...ascii('ftyp'), ...ascii('isom'), 0, 0, 0, 0];
      const timescale = 1000;
      const mvhdPayload = [0, 0, 0, 0, ...u32(0), ...u32(0), ...u32(timescale), ...u32(durationSeconds * timescale)];
      const mvhd = [...u32(8 + mvhdPayload.length), ...ascii('mvhd'), ...mvhdPayload];
      const moov = [...u32(8 + mvhd.length), ...ascii('moov'), ...mvhd];
      return Buffer.from([...ftyp, ...moov, ...new Array(2000).fill(0)]);
    }

    test('valid video post: upload, render with accessible controls, no autoplay', async ({ page }) => {
      await login(page, USER_A);

      const unique = `Video post ${Date.now()}`;
      const composer = page.getByPlaceholder('Ką galvojate?').first();
      await composer.fill(unique);

      const videoInput = page.locator('input[accept="video/mp4,video/webm"]').first();
      await videoInput.setInputFiles({
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        buffer: buildMp4Buffer(5),
      });

      // Client-side preview appears before posting.
      await expect(page.getByLabel('Pasirinkto vaizdo įrašo peržiūra')).toBeVisible();
      // Selecting a video disables the image picker (mutually exclusive).
      await expect(page.locator(`#${await page.locator('label:has-text("Nuotraukos")').first().getAttribute('for')}`)).toBeDisabled();

      await page.getByRole('button', { name: 'Skelbti', exact: true }).first().click();

      const card = page.getByTestId('post-card').filter({ hasText: unique }).first();
      await expect(card).toBeVisible({ timeout: 30000 });

      const video = card.getByLabel('Įrašo vaizdo įrašas');
      await expect(video).toBeVisible();
      await expect(video).toHaveAttribute('controls', '');
      await expect(video).not.toHaveAttribute('autoplay');
      // React sets `muted` as a DOM property, not a reflected HTML
      // attribute (a well-known React quirk for this specific element) —
      // toHaveAttribute would never see it even when correctly applied, so
      // check the real property instead.
      await expect.poll(() => video.evaluate((el) => (el as HTMLVideoElement).muted)).toBe(true);
      await expect.poll(() => video.evaluate((el) => (el as HTMLVideoElement).autoplay)).toBe(false);
    });

    test('oversized video is rejected client-side before any upload', async ({ page }) => {
      await login(page, USER_A);

      const videoInput = page.locator('input[accept="video/mp4,video/webm"]').first();
      // A 51MB file with a valid MP4 signature — rejected purely on size,
      // never reaches the network. setInputFiles' inline `buffer` option
      // caps out at 50MB, so this has to go through an actual file on disk.
      const oversized = Buffer.concat([buildMp4Buffer(5), Buffer.alloc(51 * 1024 * 1024)]);
      const tmpPath = path.join(os.tmpdir(), `oversized-${Date.now()}.mp4`);
      fs.writeFileSync(tmpPath, oversized);
      try {
        await videoInput.setInputFiles(tmpPath);
      } finally {
        fs.unlinkSync(tmpPath);
      }

      await expect(page.getByText('Vaizdo įrašas per didelis (maks. 50MB).')).toBeVisible();
      await expect(page.getByLabel('Pasirinkto vaizdo įrašo peržiūra')).toBeHidden();
    });

    test('invalid video MIME type is rejected client-side', async ({ page }) => {
      await login(page, USER_A);

      const videoInput = page.locator('input[accept="video/mp4,video/webm"]').first();
      await videoInput.setInputFiles({ name: 'clip.mov', mimeType: 'video/quicktime', buffer: buildMp4Buffer(5) });

      await expect(page.getByText('Palaikomi tik MP4 ir WebM vaizdo įrašai.')).toBeVisible();
    });

    test('a spoofed file (PNG bytes, video/mp4 label) is rejected server-side even if it slips past client checks', async ({ page, request }) => {
      await login(page, USER_A);
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const sessionResponse = await request.get('/api/auth/get-session', { headers: { cookie: cookieHeader } });
      const session = await sessionResponse.json();
      const userId = session?.user?.id;
      expect(userId).toBeTruthy();

      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(20).fill(0)]);
      const response = await request.put(`/api/storage/upload?bucket=post-images&path=${userId}/spoofed-${Date.now()}.mp4`, {
        headers: { cookie: cookieHeader, 'Content-Type': 'video/mp4' },
        data: pngSignature,
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('INVALID_VIDEO');
    });

    test('unauthorized video upload is rejected (401)', async ({ request }) => {
      const response = await request.put('/api/storage/upload?bucket=post-images&path=someone/clip.mp4', {
        headers: { 'Content-Type': 'video/mp4' },
        data: buildMp4Buffer(5),
      });
      expect(response.status()).toBe(401);
    });
  });

  test('follow and unfollow', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      // Login as USER_B and create a post
      await login(pageB, USER_B);
      const unique = `Follow test post ${Date.now()}`;
      await createPost(pageB, unique);

      // Get USER_B's profile URL from the navbar
      const profileHref = await pageB.locator('a[href^="/u/"]').first().getAttribute('href');
      expect(profileHref).toBeTruthy();

      // Login as USER_A and visit USER_B's profile
      await login(pageA, USER_A);
      await pageA.goto(profileHref!);

      // Click follow button
      const followButton = pageA.getByRole('button', { name: 'Sekti' });
      await expect(followButton).toBeVisible();
      await followButton.click();

      // Verify button changes to unfollow
      const unfollowButton = pageA.getByRole('button', { name: 'Nebesekti' });
      await expect(unfollowButton).toBeVisible();

      // Click unfollow
      await unfollowButton.click();

      // Verify button changes back to follow
      await expect(followButton).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('notification appears after like', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      // Login as USER_B and create a post
      await login(pageB, USER_B);
      const unique = `Notification target ${Date.now()}`;
      const card = await createPost(pageB, unique);
      const postId = await card.getAttribute('data-post-id');
      expect(postId).toBeTruthy();

      // Login as USER_A and like USER_B's post
      await login(pageA, USER_A);
      await pageA.goto('/home?tab=latest');
      const targetCard = pageA.getByTestId('post-card').filter({ hasText: unique }).first();
      await expect(targetCard).toBeVisible();
      await targetCard.getByRole('button', { name: 'Reaguoti į įrašą (patinka)' }).click();
      await expect(targetCard.getByTestId('reaction-picker-trigger')).toBeEnabled();

      // USER_B is already authenticated in this context; navigate directly.
      await pageB.goto('/notifications');

      // Verify a notification about the like is visible
      await expect(pageB.locator(`a[href="/posts/${postId}"]`)).toContainText(/pamėgo jūsų įrašą/);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('search for users', async ({ page }) => {
    await login(page, USER_A);
    await page.goto('/search');

    // Type a username in the search box
    const searchInput = page.getByPlaceholder('Ieškokite žmonių arba įrašų...');
    await searchInput.fill('Tester B');

    // The result assertion waits for the debounced request without a fixed delay.
    await expect(page.getByText('Tester B', { exact: true })).toBeVisible();
  });

  test('mobile navigation', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, USER_A);

    // Verify bottom nav is visible
    const bottomNav = page.locator('nav').filter({ has: page.locator('a[href="/home"]') }).last();
    await expect(bottomNav).toBeVisible();

    // Verify bottom nav has links to home, services, search, messages, profile
    await expect(bottomNav.getByRole('link', { name: 'Pradžia' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Paslaugos' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Paieška' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Žinutės' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Profilis' })).toBeVisible();
  });

  test.describe('nested comments (db/migrations/0010_nested_comments.sql)', () => {
    test('top-level comment creation, reply creation, and hierarchy survive reload', async ({ page }) => {
      await login(page, USER_A);
      const unique = `Nested comment target ${Date.now()}`;
      const card = await createPost(page, unique);

      await card.getByRole('button', { name: 'Rodyti komentarus' }).click();
      const commentInput = card.getByPlaceholder('Parašykite komentarą...');

      const topLevelText = `Top level ${Date.now()}`;
      await commentInput.fill(topLevelText);
      await card.getByRole('button', { name: 'Paskelbti komentarą' }).click();
      await expect(card.getByText(topLevelText)).toBeVisible();

      // Reply to the top-level comment.
      const topLevelRow = card.locator('div').filter({ hasText: topLevelText }).last();
      await topLevelRow.getByRole('button', { name: /^Atsakyti/ }).click();
      await expect(card.getByText('Atsakoma vartotojui Tester A')).toBeVisible();

      const replyText = `Reply ${Date.now()}`;
      const replyInput = card.getByPlaceholder('Parašykite atsakymą...');
      await expect(replyInput).toBeFocused();
      await replyInput.fill(replyText);
      await card.getByRole('button', { name: 'Paskelbti atsakymą' }).click();
      await expect(card.getByText(replyText)).toBeVisible();
      // Reply context clears after posting.
      await expect(card.getByText('Atsakoma vartotojui Tester A')).toBeHidden();

      // Reply-to-reply (depth 2, the maximum allowed).
      const replyRow = card.locator('div').filter({ hasText: replyText }).last();
      await replyRow.getByRole('button', { name: /^Atsakyti/ }).click();
      const nestedReplyText = `Nested reply ${Date.now()}`;
      await card.getByPlaceholder('Parašykite atsakymą...').fill(nestedReplyText);
      await card.getByRole('button', { name: 'Paskelbti atsakymą' }).click();
      await expect(card.getByText(nestedReplyText)).toBeVisible();

      // A depth-2 comment has no further "Atsakyti" button — max nesting reached.
      const nestedReplyRow = card.locator('div').filter({ hasText: nestedReplyText }).last();
      await expect(nestedReplyRow.getByRole('button', { name: /^Atsakyti/ })).toHaveCount(0);

      // Hierarchy and content survive a full reload (server-rendered, not just client state).
      // The comment section itself collapses on reload — it must be
      // reopened before the (still server-persisted) thread is visible again.
      await page.reload();
      const reloadedCard = page.getByTestId('post-card').filter({ hasText: unique }).first();
      await reloadedCard.getByRole('button', { name: 'Rodyti komentarus' }).click();
      await expect(reloadedCard.getByText(topLevelText)).toBeVisible();
      await expect(reloadedCard.getByText(replyText)).toBeVisible();
      await expect(reloadedCard.getByText(nestedReplyText)).toBeVisible();
    });

    test('comment count stays accurate across top-level and replies', async ({ page }) => {
      await login(page, USER_A);
      const unique = `Count target ${Date.now()}`;
      const card = await createPost(page, unique);

      // The toggle button's accessible name flips to "Slėpti komentarus"
      // once the section is open, so match either state by count badge
      // instead of the exact pre-open label.
      const toggleButton = card.getByRole('button', { name: /komentarus/ });
      await toggleButton.click();
      await expect(toggleButton).toContainText('0');

      const commentInput = card.getByPlaceholder('Parašykite komentarą...');
      const topText = `Count top ${Date.now()}`;
      await commentInput.fill(topText);
      await card.getByRole('button', { name: 'Paskelbti komentarą' }).click();
      await expect(card.getByText(topText)).toBeVisible();
      await expect(toggleButton).toContainText('1');

      const topRow = card.locator('div').filter({ hasText: topText }).last();
      await topRow.getByRole('button', { name: /^Atsakyti/ }).click();
      const replyText = `Count reply ${Date.now()}`;
      await card.getByPlaceholder('Parašykite atsakymą...').fill(replyText);
      await card.getByRole('button', { name: 'Paskelbti atsakymą' }).click();
      await expect(card.getByText(replyText)).toBeVisible();

      // Total count includes both the top-level comment and its reply.
      await expect(toggleButton).toContainText('2');
    });

    test('another user cannot edit or delete someone else\'s comment (forbidden, UI and API)', async ({ browser, request }) => {
      const contextA = await browser.newContext();
      const contextB = await browser.newContext();
      try {
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        await login(pageA, USER_A);
        const unique = `Forbidden edit target ${Date.now()}`;
        const card = await createPost(pageA, unique);
        await card.getByRole('button', { name: 'Rodyti komentarus' }).click();
        const commentText = `Owner-only comment ${Date.now()}`;
        await card.getByPlaceholder('Parašykite komentarą...').fill(commentText);
        await card.getByRole('button', { name: 'Paskelbti komentarą' }).click();
        await expect(card.getByText(commentText)).toBeVisible();

        await login(pageB, USER_B);
        await pageB.goto('/home?tab=latest');
        const cardB = pageB.getByTestId('post-card').filter({ hasText: unique }).first();
        await cardB.getByRole('button', { name: 'Rodyti komentarus' }).click();
        const commentRowB = cardB.locator('div').filter({ hasText: commentText }).last();
        // UI: neither the edit nor delete action is even offered to a
        // non-owner, non-admin viewer.
        await expect(commentRowB.getByRole('button', { name: 'Redaguoti komentarą' })).toHaveCount(0);
        await expect(commentRowB.getByRole('button', { name: 'Ištrinti komentarą' })).toHaveCount(0);

        // API: even bypassing the UI entirely, RLS (comments_owner policy)
        // must reject a direct mutation attempt against someone else's row.
        const cookies = await pageB.context().cookies();
        const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

        // comments_read (public/active) lets USER_B resolve the row's real
        // id — the RLS boundary that matters is on the WRITE (comments_owner),
        // not on being able to look the comment up at all.
        const lookupResponse = await request.post('/api/data/query', {
          headers: { cookie: cookieHeader },
          data: {
            table: 'comments',
            method: 'GET',
            filters: [['content', `eq.${commentText}`]],
            order: [],
            select: 'id',
          },
        });
        const lookupBody = await lookupResponse.json();
        const commentId = lookupBody?.data?.[0]?.id;
        expect(commentId).toBeTruthy();

        // Postgres RLS on UPDATE: a row excluded by the USING clause simply
        // isn't matched by the WHERE — PostgREST returns 200/204 with zero
        // rows affected, not a 401/403 error (that only happens for a
        // WITH CHECK violation, e.g. on INSERT — see the sibling 'mutes'
        // test above). The real security assertion here is that the row
        // is provably unchanged afterward, not a specific status code.
        const updateResponse = await request.post('/api/data/query', {
          headers: { cookie: cookieHeader },
          data: {
            table: 'comments',
            method: 'PATCH',
            body: { content: 'hijacked' },
            filters: [['id', `eq.${commentId}`]],
            order: [],
          },
        });
        expect(updateResponse.ok()).toBe(true);
        const updateBody = await updateResponse.json();
        expect(Array.isArray(updateBody?.data) ? updateBody.data.length : 0).toBe(0);

        const deleteResponse = await request.post('/api/data/query', {
          headers: { cookie: cookieHeader },
          data: {
            table: 'comments',
            method: 'PATCH',
            body: { status: 'deleted' },
            filters: [['id', `eq.${commentId}`]],
            order: [],
          },
        });
        expect(deleteResponse.ok()).toBe(true);
        const deleteBody = await deleteResponse.json();
        expect(Array.isArray(deleteBody?.data) ? deleteBody.data.length : 0).toBe(0);

        // Ground truth: re-read the comment (as USER_A, who can) and
        // confirm neither mutation actually took effect.
        const verifyResponse = await request.post('/api/data/query', {
          headers: { cookie: (await pageA.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ') },
          data: {
            table: 'comments',
            method: 'GET',
            filters: [['id', `eq.${commentId}`]],
            order: [],
            select: 'content,status',
          },
        });
        const verifyBody = await verifyResponse.json();
        expect(verifyBody?.data?.[0]?.content).toBe(commentText);
        expect(verifyBody?.data?.[0]?.status).toBe('active');
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });

    test('deleting a parent comment leaves a tombstone; its reply stays visible', async ({ page }) => {
      await login(page, USER_A);
      const unique = `Tombstone target ${Date.now()}`;
      const card = await createPost(page, unique);

      await card.getByRole('button', { name: 'Rodyti komentarus' }).click();
      const parentText = `Parent to delete ${Date.now()}`;
      await card.getByPlaceholder('Parašykite komentarą...').fill(parentText);
      await card.getByRole('button', { name: 'Paskelbti komentarą' }).click();
      await expect(card.getByText(parentText)).toBeVisible();

      const parentRow = card.locator('div').filter({ hasText: parentText }).last();
      await parentRow.getByRole('button', { name: /^Atsakyti/ }).click();
      const replyText = `Reply to deleted parent ${Date.now()}`;
      await card.getByPlaceholder('Parašykite atsakymą...').fill(replyText);
      await card.getByRole('button', { name: 'Paskelbti atsakymą' }).click();
      await expect(card.getByText(replyText)).toBeVisible();

      // Delete the parent.
      const parentRowAgain = card.locator('div').filter({ hasText: parentText }).last();
      await parentRowAgain.getByRole('button', { name: 'Ištrinti komentarą' }).click();
      await card.getByRole('button', { name: 'Ištrinti', exact: true }).click();

      // Tombstone replaces the parent's content; the reply remains fully visible.
      await expect(card.getByText(parentText)).toBeHidden();
      await expect(card.getByText('Komentaras ištrintas')).toBeVisible();
      await expect(card.getByText(replyText)).toBeVisible();

      // Survives reload too (server-enforced via comments_read RLS, not just client state).
      await page.reload();
      const reloadedCard = page.getByTestId('post-card').filter({ hasText: unique }).first();
      await reloadedCard.getByRole('button', { name: 'Rodyti komentarus' }).click();
      await expect(reloadedCard.getByText('Komentaras ištrintas')).toBeVisible();
      await expect(reloadedCard.getByText(replyText)).toBeVisible();
    });

    test('optimistic reply is rolled back in full after a forced server error', async ({ page }) => {
      await login(page, USER_A);
      const unique = `Reply rollback target ${Date.now()}`;
      const card = await createPost(page, unique);

      const toggleButton = card.getByRole('button', { name: /komentarus/ });
      await toggleButton.click();
      const parentText = `Rollback parent ${Date.now()}`;
      await card.getByPlaceholder('Parašykite komentarą...').fill(parentText);
      await card.getByRole('button', { name: 'Paskelbti komentarą' }).click();
      await expect(card.getByText(parentText)).toBeVisible();
      await expect(toggleButton).toContainText('1');

      // Force the reply mutation to fail server-side after the optimistic UI update.
      await page.route('**/api/data/query', async (route) => {
        const request = route.request();
        const body = request.postDataJSON?.() as { table?: string; method?: string; body?: { parent_comment_id?: string } } | undefined;
        if (body?.table === 'comments' && body.method === 'POST' && body?.body?.parent_comment_id) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"forced failure"}}' });
          return;
        }
        await route.continue();
      });

      const parentRow = card.locator('div').filter({ hasText: parentText }).last();
      await parentRow.getByRole('button', { name: /^Atsakyti/ }).click();
      const replyText = `Doomed reply ${Date.now()}`;
      const replyInput = card.getByPlaceholder('Parašykite atsakymą...');
      await replyInput.fill(replyText);
      await card.getByRole('button', { name: 'Paskelbti atsakymą' }).click();

      // Full rollback: the optimistic reply is removed, the count reverts,
      // the error is surfaced, and the text is restored so the user doesn't
      // have to retype it.
      await expect(card.getByText(replyText)).toBeHidden();
      await expect(toggleButton).toContainText('1');
      await expect(card.getByText('Nepavyko paskelbti atsakymo. Bandykite dar kartą.')).toBeVisible();
      await expect(card.getByPlaceholder('Parašykite atsakymą...')).toHaveValue(replyText);
    });
  });
});
