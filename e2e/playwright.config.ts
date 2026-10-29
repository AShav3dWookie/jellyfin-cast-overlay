import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    globalSetup: './tests/global-setup.ts',
    timeout: 90_000,
    expect: { timeout: 15_000 },
    // Tests share one server and change plugin settings, so run them one at a time.
    workers: 1,
    fullyParallel: false,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    use: {
        baseURL: process.env.JELLYFIN_URL ?? 'http://localhost:8197',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 720 },
                launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] }
            }
        }
    ]
});
