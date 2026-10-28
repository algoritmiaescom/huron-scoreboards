import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const fixtureUrl = 'http://127.0.0.1:4175/src/test/fixtures/scoreboard-primitives.html';

for (const mode of ['light', 'dark'] as const) {
  test(`primitives preserve semantics and reflow in ${mode}`, async ({ page }) => {
    await page.addInitScript((themeMode) => {
      localStorage.setItem('huron-scoreboards.theme-mode', themeMode);
    }, mode);
    await page.goto(fixtureUrl);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content, `${mode} ${String(width)}x${String(height)}`).toBeLessThanOrEqual(
        dimensions.width,
      );
      const cells = page.getByRole('img', { name: /Problema/ });
      for (const cell of await cells.all()) {
        const box = await cell.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(68);
        expect(box?.height).toBeGreaterThanOrEqual(48);
      }
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    const desktop = page.getByRole('table', { name: 'Resultados de prueba' });
    const cards = page.getByLabel('Tarjetas de prueba');
    const names = (container: typeof desktop) =>
      container
        .getByRole('img', { name: /Problema/ })
        .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('aria-label')));
    expect(await names(desktop)).toEqual(await names(cards));
    await expect(desktop.getByRole('columnheader')).toHaveText([
      'Equipo',
      'Problema B',
      'Problema A',
      'Problema C',
    ]);
    await expect(desktop.getByRole('img', { name: /primero en resolver/ })).toHaveCount(3);
  });
}

test('cells show complete descriptions on keyboard focus and hover, and rosters expand by keyboard', async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  const first = page.getByRole('table').getByRole('img', { name: /Alpha. Problema A/ });
  await first.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(first).toBeFocused();
  await expect(page.getByRole('tooltip')).toContainText('primero en resolver (posible empate)');
  expect(await first.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('3px');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).not.toBeVisible();
  const attempted = page.getByRole('table').getByRole('img', { name: /Alpha. Problema B/ });
  await attempted.hover();
  await expect(page.getByRole('tooltip')).toContainText('9 intentos fallidos, sin resolver');
  const roster = page.locator('summary');
  await roster.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Ana — Concursante')).toBeVisible();
  await expect(page.getByText('Bruno — Entrenador/a')).toBeVisible();
  await expect(page.getByText('Carmen')).toBeVisible();
});

test.describe('touch descriptions', () => {
  test.use({ hasTouch: true });
  test('exposes problem details on tap without hover', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixtureUrl);
    await page
      .getByRole('list', { name: 'Resultados por problema de Alpha' })
      .getByRole('img', { name: /Problema A/ })
      .tap();
    await expect(page.getByRole('tooltip')).toContainText(
      'los intentos incluyen el envío aceptado',
    );
    await page.getByRole('heading', { level: 1 }).tap();
    await expect(page.getByRole('tooltip')).not.toBeVisible();
  });
});

test('supports enlarged text and keyboard scrolling in a contained table', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(fixtureUrl);
  const region = page.getByRole('region', {
    name: 'Tabla de prueba con desplazamiento horizontal',
  });
  const last = region.getByRole('img', { name: /Delta. Problema C/ });
  await last.focus();
  await expect(last).toBeInViewport();
  const geometry = await last.evaluate((element) => {
    const parent = element.closest('[role="region"]');
    if (parent === null) {
      throw new Error('Missing scroll container');
    }
    const cell = element.getBoundingClientRect();
    const bounds = parent.getBoundingClientRect();
    return { left: cell.left, right: cell.right, start: bounds.left, end: bounds.right };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(geometry.start);
  expect(geometry.right).toBeLessThanOrEqual(geometry.end);
  await page.setViewportSize({ width: 640, height: 450 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  });
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.width);
});
