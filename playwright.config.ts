import { defineConfig, devices } from '@playwright/test';

const basePath = process.env.VITE_BASE_PATH ?? '/huron-scoreboards/';
process.env.VITE_BASE_PATH = basePath;
const previewURL = `http://127.0.0.1:4173${basePath}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: previewURL,
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
      url: previewURL,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
      env: { VITE_DATA_SOURCE: 'mock', VITE_BASE_PATH: '/' },
      reuseExistingServer: !process.env.CI,
      url: 'http://127.0.0.1:4175/src/test/fixtures/scoreboard-primitives.html',
    },
  ],
});
