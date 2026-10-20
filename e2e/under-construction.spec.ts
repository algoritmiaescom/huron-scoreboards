import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('shows the under construction screen without accessibility violations', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Under construction' })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test('restores a saved theme across reloads', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('huron-scoreboards.theme-mode', 'dark');
  });
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 24, 35)');
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 24, 35)');
  await page.evaluate(() => {
    localStorage.setItem('huron-scoreboards.theme-mode', 'light');
  });
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 244, 239)');
});

test('loads fonts locally and uses its initial light palette', async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) {
      remoteRequests.push(request.url());
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Under construction' })).toBeVisible();

  const typography = await page.evaluate(async () => {
    const display = await document.fonts.load('700 16px "Space Grotesk Variable"');
    const data = await document.fonts.load('600 16px "IBM Plex Mono"');

    return {
      displayFaces: display.length,
      dataFaces: data.length,
      background: getComputedStyle(document.body).backgroundColor,
    };
  });

  expect(typography.displayFaces).toBeGreaterThan(0);
  expect(typography.dataFaces).toBeGreaterThan(0);
  expect(typography.background).toBe('rgb(245, 244, 239)');
  expect(remoteRequests).toEqual([]);
});

test('reflows the placeholder across the responsive verification matrix', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { name: 'Under construction' });
  await expect(heading).toBeVisible();

  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(heading).toBeInViewport();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `${String(width)} x ${String(height)} overflow`).toBeLessThanOrEqual(
      dimensions.viewport,
    );
  }
});
