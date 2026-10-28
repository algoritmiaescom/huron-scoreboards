import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1',
      reuseExistingServer: !process.env.CI,
      url: 'http://127.0.0.1:4173',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
      env: { VITE_DATA_SOURCE: 'mock' },
      reuseExistingServer: !process.env.CI,
      url: 'http://127.0.0.1:4175/src/test/fixtures/scoreboard-primitives.html',
    },
  ],
});
