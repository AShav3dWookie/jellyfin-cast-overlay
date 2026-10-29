import { expect, test } from '@playwright/test';
import { api, loadState } from './lib/jellyfin';

test.describe('script injection', () => {
    test('index.html served by Jellyfin includes the overlay script', async ({ request }) => {
        const response = await request.get('/web/index.html');
        expect(response.ok()).toBeTruthy();
        const html = await response.text();

        expect(html).toMatch(/<script defer data-cast-overlay src="\.\.\/CastOverlay\/ClientScript\?v=[\d.]+"><\/script><\/body>/);
        expect(html.match(/data-cast-overlay/g)).toHaveLength(1);
    });

    test('client script is served anonymously as JavaScript', async ({ request }) => {
        const response = await request.get('/CastOverlay/ClientScript?v=1');
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('javascript');
        expect(await response.text()).toContain('[CastOverlay]');
    });

    test('status reports the File Transformation registration', async () => {
        const { token } = loadState();
        const status = await api<{ State: string; Message?: string }>('/CastOverlay/Status', { token });

        // Jellyfin omits null properties from JSON.
        expect(status).toEqual({ State: 'Registered' });
    });

    test('status requires an administrator', async () => {
        const response = await api<Response>('/CastOverlay/Status', { raw: true });

        expect(response.status).toBe(401);
    });
});
