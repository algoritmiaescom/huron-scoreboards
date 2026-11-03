import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4175';
const accumulatedUrl = `${origin}/#/scoreboards?season=2024&series=gpm&view=accumulated`;
const contestUrl = `${origin}/#/scoreboards?contest=2024-gpm-qualifier-1`;
const title = 'Clasificación acumulada 2024';

test.beforeEach(async ({ page }) => {
  await page.route('https://example.com/**', (route) => route.abort());
});

test('selects, reloads, shares and restores the distinct accumulated view through history', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.goto(`${contestUrl}&team=UNAM`);
  await page
    .getByRole('combobox', { name: 'Clasificación', exact: true })
    .selectOption('accumulated');
  await expect(page).toHaveURL(accumulatedUrl);
  await expect(page).toHaveTitle('Acumulada 2024 - Gran Premio de México | Huron Scoreboards');
  const table = page.getByRole('table', { name: title });
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await expect(table.getByText('92.5', { exact: true })).toBeVisible();
  await expect(table.getByText('Clasificado', { exact: true })).toHaveCount(8);
  await expect(table.getByText('No clasificado', { exact: true })).toHaveCount(2);
  await expect(table.locator('[data-cut="true"]')).toHaveCount(1);
  await expect(table.locator('[data-cut="true"]')).toContainText('#8');
  await expect(page.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveCount(0);
  await expect(page.getByText(/estados de clasificación.*inventados/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fuente de ejemplo' })).toHaveAttribute(
    'href',
    'https://example.com/huron-scoreboards/mock-data',
  );
  await expect(page.getByRole('link', { name: 'Cómo corregir estos datos' })).toHaveAttribute(
    'href',
    '#/contribute',
  );
  await page.getByRole('button', { name: 'Compartir vista' }).click();
  await expect(page.getByText('Enlace copiado')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(accumulatedUrl);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Clasificación', exact: true })).toHaveValue(
    'accumulated',
  );
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveValue('UNAM');
  await page.goForward();
  await expect(table).toBeVisible();
  await page.getByRole('combobox', { name: 'Temporada' }).selectOption('2025');
  await expect(page).toHaveURL(`${origin}/#/scoreboards?season=2025&series=gpm&view=accumulated`);
  await expect(page.getByRole('table').getByText('114.8', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Temporada' }).selectOption('2023');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(
    page
      .getByRole('combobox', { name: 'Clasificación', exact: true })
      .locator('option[value="accumulated"]'),
  ).toHaveCount(0);
  expect(new URL(page.url().split('#')[1], origin).searchParams.has('contest')).toBe(true);
});

test('recovers missing selections and incompatible filters without substituting results', async ({
  page,
}) => {
  await page.goto(`${origin}/#/scoreboards?season=2023&series=gpm&view=accumulated`);
  await expect(page.getByRole('alert')).toContainText('No hay clasificación acumulada publicada');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Temporada' }).selectOption('2024');
  await page.getByRole('combobox', { name: 'Serie', exact: true }).selectOption('gpm');
  await page
    .getByRole('combobox', { name: 'Clasificación', exact: true })
    .selectOption('accumulated');
  await expect(page).toHaveURL(accumulatedUrl);
  await page.goto(`${accumulatedUrl}&problem=A&first=1`);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Los filtros de concurso' }),
  ).toContainText('Los filtros de concurso no están disponibles');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Quitar filtros de concurso' }).click();
  await expect(page).toHaveURL(accumulatedUrl);
  await expect(page.getByRole('table')).toBeVisible();
});

for (const mode of ['light', 'dark'] as const) {
  test(`accumulated standings retain published data across responsive sizes in ${mode}`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('huron-scoreboards.theme-mode', value);
    }, mode);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(accumulatedUrl);
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [1920, 1080],
      [599, 800],
      [600, 800],
      [601, 800],
      [899, 800],
      [900, 800],
      [901, 800],
      [1199, 800],
      [1200, 800],
      [1201, 800],
      [1535, 900],
      [1536, 900],
      [1537, 900],
    ]) {
      await page.setViewportSize({ width, height });
      const results = page.getByRole(width < 900 ? 'list' : 'table', { name: title });
      await expect(results).toBeVisible();
      await expect(results.locator(width < 900 ? ':scope > li' : 'tbody tr')).toHaveCount(10);
      await expect(results.getByText('92.5', { exact: true })).toHaveCount(1);
      await expect(results.getByText('Clasificado', { exact: true })).toHaveCount(8);
      await expect(results.getByText('No clasificado', { exact: true })).toHaveCount(2);
      await expect(results.locator('[data-cut="true"]')).toHaveCount(1);
      await expect(page.getByRole('combobox', { name: 'Clasificación', exact: true })).toHaveValue(
        'accumulated',
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        `${mode} ${String(width)}x${String(height)}`,
      ).toBe(true);
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole(width < 900 ? 'list' : 'table', { name: title })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    const region = page.getByRole('region', { name: 'Clasificación acumulada con desplazamiento' });
    await region.focus();
    await expect(region).toBeFocused();
    await page.keyboard.press('End');
    await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.getByRole('list', { name: title })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test.describe('touch accumulated selection', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('switches to cards with an accessible touch-sized picker', async ({ page }) => {
    await page.goto(contestUrl);
    const picker = page.getByRole('combobox', { name: 'Clasificación', exact: true });
    await picker.tap();
    await picker.selectOption('accumulated');
    await expect(page.getByRole('list', { name: title })).toBeVisible();
    expect((await picker.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page).toHaveURL(accumulatedUrl);
  });
});
