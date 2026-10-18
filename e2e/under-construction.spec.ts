import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('shows the under construction screen without accessibility violations', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Under construction' })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
