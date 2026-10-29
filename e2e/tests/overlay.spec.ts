import { expect, test } from '@playwright/test';
import { DEFAULT_TEST_CONFIG, loadState, setPluginConfig } from './lib/jellyfin';
import { OVERLAY, castNames, castRoles, login, pause, play, resume } from './lib/player';

const state = loadState();

test.describe('cast overlay', () => {
    test.beforeEach(async ({ page }) => {
        await setPluginConfig(state.token, DEFAULT_TEST_CONFIG);
        await login(page);
    });

    test.afterAll(async () => {
        await setPluginConfig(state.token, DEFAULT_TEST_CONFIG);
    });

    test('shows the movie cast after pausing, in billing order', async ({ page }, testInfo) => {
        await play(page, state.movieId);
        await pause(page);

        const overlay = page.locator(OVERLAY);
        await expect(overlay).toBeVisible();
        await expect(overlay).toHaveClass(/castOverlay-visible/);
        await expect(overlay.locator('.castOverlay-title')).toHaveText('Cast Overlay Test Movie');
        expect(await castNames(page)).toEqual(['Avery Testington', 'Blake Fixturewood', 'Casey Stubbleton']);
        expect(await castRoles(page)).toEqual(['Captain Placeholder', 'Dr. Mock', 'The Narrator']);

        // The person with an uploaded headshot gets a loaded image; the rest get initials.
        const photo = overlay.locator('img.castOverlay-photo');
        await expect(photo).toHaveCount(1);
        await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
        await expect(overlay.locator('.castOverlay-initials')).toHaveText(['BF', 'CS']);

        // Drawn on the left, above the video.
        const box = (await overlay.boundingBox())!;
        expect(box.x).toBe(0);
        expect(box.width).toBeLessThan(1280 / 2);

        await testInfo.attach('movie-overlay', { body: await page.screenshot(), contentType: 'image/png' });
    });

    test('hides as soon as playback resumes', async ({ page }) => {
        await play(page, state.movieId);
        await pause(page);
        await expect(page.locator(OVERLAY)).toBeVisible();

        await resume(page);

        await expect(page.locator(OVERLAY)).toHaveCount(0);
    });

    test('does not block the player controls', async ({ page }) => {
        await play(page, state.movieId);
        await pause(page);
        await expect(page.locator(OVERLAY)).toBeVisible();
        await expect(page.locator(OVERLAY)).toHaveCSS('pointer-events', 'none');

        // Use jellyfin-web's own play/pause button, which sits under the overlay's area.
        await page.mouse.move(640, 360);
        const playPause = page.locator('.videoOsdBottom .btnPause');
        await expect(playPause).toBeVisible();
        await playPause.click();

        await expect.poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>('video.htmlvideoplayer')!.paused))
            .toBe(false);
        await expect(page.locator(OVERLAY)).toHaveCount(0);
    });

    test('does not flash on a quick pause', async ({ page }) => {
        await play(page, state.movieId);
        await pause(page);
        await page.waitForTimeout(300);
        await resume(page);

        await page.waitForTimeout(DEFAULT_TEST_CONFIG.ShowDelayMs + 1000);
        await expect(page.locator(OVERLAY)).toHaveCount(0);
    });

    test('waits for the configured delay', async ({ page }) => {
        await setPluginConfig(state.token, { ShowDelayMs: 3000 });
        await play(page, state.movieId);
        await pause(page);

        await page.waitForTimeout(2000);
        await expect(page.locator(OVERLAY)).toHaveCount(0);
        await expect(page.locator(OVERLAY)).toBeVisible({ timeout: 5000 });
    });

    test('episodes show series regulars before guest stars', async ({ page }) => {
        await play(page, state.episodeId);
        await pause(page);

        await expect(page.locator(OVERLAY)).toBeVisible();
        await expect(page.locator(`${OVERLAY} .castOverlay-title`)).toHaveText('The One With The Guest');
        // Riley is credited on both the series and the episode but appears once, as a regular.
        expect(await castNames(page)).toEqual(['Riley Regularson', 'Morgan Mainstay', 'Gale Gueststar']);
        expect(await castRoles(page)).toEqual(['The Lead', 'The Sidekick', 'The Visitor']);
    });

    test('guest stars can be turned off', async ({ page }) => {
        await setPluginConfig(state.token, { IncludeGuestStars: false });
        await play(page, state.episodeId);
        await pause(page);

        await expect(page.locator(OVERLAY)).toBeVisible();
        expect(await castNames(page)).toEqual(['Riley Regularson', 'Morgan Mainstay']);
    });

    test('respects the maximum cast size', async ({ page }) => {
        await setPluginConfig(state.token, { MaxCastMembers: 2 });
        await play(page, state.movieId);
        await pause(page);

        await expect(page.locator(OVERLAY)).toBeVisible();
        expect(await castNames(page)).toEqual(['Avery Testington', 'Blake Fixturewood']);
    });

    test('can be drawn on the right', async ({ page }, testInfo) => {
        await setPluginConfig(state.token, { Position: 'Right' });
        await play(page, state.movieId);
        await pause(page);

        const overlay = page.locator(OVERLAY);
        await expect(overlay).toBeVisible();
        await expect(overlay).toHaveClass(/castOverlay-right/);
        const box = (await overlay.boundingBox())!;
        expect(Math.round(box.x + box.width)).toBe(1280);

        await testInfo.attach('right-overlay', { body: await page.screenshot(), contentType: 'image/png' });
    });

    test('does nothing when disabled', async ({ page }) => {
        await setPluginConfig(state.token, { Enabled: false });
        await play(page, state.movieId);
        await pause(page);

        await page.waitForTimeout(DEFAULT_TEST_CONFIG.ShowDelayMs + 1500);
        await expect(page.locator(OVERLAY)).toHaveCount(0);
    });

    test('goes away when leaving the player', async ({ page }) => {
        await play(page, state.movieId);
        await pause(page);
        await expect(page.locator(OVERLAY)).toBeVisible();

        await page.goBack();

        await expect(page).not.toHaveURL(/#\/video/);
        await expect(page.locator(OVERLAY)).toHaveCount(0);
    });
});

test.describe('mobile layout', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('fits a phone screen', async ({ page }, testInfo) => {
        await setPluginConfig(state.token, DEFAULT_TEST_CONFIG);
        await login(page);
        await play(page, state.movieId);
        await pause(page);

        const overlay = page.locator(OVERLAY);
        await expect(overlay).toBeVisible();
        const box = (await overlay.boundingBox())!;
        expect(box.width).toBeLessThanOrEqual(390);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

        // Clears the player's header, whose title wraps on narrow screens.
        const header = (await page.locator('.skinHeader').boundingBox())!;
        const heading = (await overlay.locator('.castOverlay-heading').boundingBox())!;
        expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height);

        await testInfo.attach('mobile-overlay', { body: await page.screenshot(), contentType: 'image/png' });
    });
});
