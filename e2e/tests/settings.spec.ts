import { expect, test } from '@playwright/test';
import { DEFAULT_TEST_CONFIG, PLUGIN_ID, type PluginConfig, api, loadState, setPluginConfig } from './lib/jellyfin';
import { login } from './lib/player';

const state = loadState();

test.describe('settings page', () => {
    test.afterEach(async () => {
        await setPluginConfig(state.token, DEFAULT_TEST_CONFIG);
    });

    test('loads the current settings and saves changes', async ({ page }) => {
        await setPluginConfig(state.token, DEFAULT_TEST_CONFIG);
        await login(page);
        await page.goto('/web/#/configurationpage?name=Cast%20Overlay');

        const form = page.locator('#CastOverlayConfigForm');
        await expect(form).toBeVisible();
        await expect(page.locator('#ShowDelayMs')).toHaveValue(String(DEFAULT_TEST_CONFIG.ShowDelayMs));
        await expect(page.locator('#MaxCastMembers')).toHaveValue(String(DEFAULT_TEST_CONFIG.MaxCastMembers));
        await expect(page.locator('#Enabled')).toBeChecked();
        await expect(page.locator('#IncludeGuestStars')).toBeChecked();
        await expect(page.locator('#Position')).toHaveValue('Left');

        // File Transformation is installed, so no warning.
        await expect(page.locator('#CastOverlayStatus')).toBeHidden();

        await page.locator('#MaxCastMembers').fill('5');
        await page.locator('#ShowDelayMs').fill('2500');
        await page.locator('#Position').selectOption('Right');
        await page.locator('#IncludeGuestStars').uncheck({ force: true });
        await form.locator('button[type="submit"]').click();

        await expect.poll(() => api<PluginConfig>(`/Plugins/${PLUGIN_ID}/Configuration`, { token: state.token }))
            .toMatchObject({ MaxCastMembers: 5, ShowDelayMs: 2500, Position: 'Right', IncludeGuestStars: false, Enabled: true });
    });
});
