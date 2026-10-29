import { expect, type Page } from '@playwright/test';
import { ADMIN_PASSWORD, ADMIN_USER } from './jellyfin';

export const OVERLAY = '#castOverlay';

export async function login(page: Page): Promise<void> {
    await page.goto('/web/');
    await page.locator('#txtManualName').fill(ADMIN_USER);
    await page.locator('#txtManualPassword').fill(ADMIN_PASSWORD);
    await page.locator('.button-submit').click();
    await page.waitForURL(/#\/home/);
    await expect.poll(() => page.evaluate(() => (window as { __castOverlayLoaded?: boolean }).__castOverlayLoaded))
        .toBe(true);
}

/** Opens an item's detail page, presses Play and waits until the video is actually playing. */
export async function play(page: Page, itemId: string): Promise<void> {
    await page.goto(`/web/#/details?id=${itemId}`);
    const playButton = page.locator('.detailPagePrimaryContainer .btnPlay, .mainDetailButtons .btnPlay').first();
    await playButton.click();
    await page.waitForURL(/#\/video/);
    await page.waitForFunction(() => {
        const video = document.querySelector<HTMLVideoElement>('video.htmlvideoplayer');
        return !!video && !video.paused && video.currentTime > 1;
    }, null, { timeout: 30_000 });
}

export async function pause(page: Page): Promise<void> {
    await page.evaluate(() => document.querySelector<HTMLVideoElement>('video.htmlvideoplayer')!.pause());
}

export async function resume(page: Page): Promise<void> {
    await page.evaluate(() => document.querySelector<HTMLVideoElement>('video.htmlvideoplayer')!.play());
}

export async function castNames(page: Page): Promise<string[]> {
    return page.locator(`${OVERLAY} .castOverlay-name`).allTextContents();
}

export async function castRoles(page: Page): Promise<string[]> {
    return page.locator(`${OVERLAY} .castOverlay-member`).evaluateAll((members) =>
        members.map((m) => m.querySelector('.castOverlay-role')?.textContent ?? ''));
}
