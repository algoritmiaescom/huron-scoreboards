import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4175';
const directoryUrl = `${origin}/schools`;
const searchLabel = 'Buscar instituciones, unidades, ciudades o estados';

test.beforeEach(async ({ page }) => {
  await page.route('https://example.com/**', (route) => route.abort());
});

test('searches stable identities and locations with reloadable URLs and honest recovery', async ({
  page,
}) => {
  await page.goto(directoryUrl);
  await expect(page).toHaveTitle('Instituciones | Huron Scoreboards');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(15);
  await expect(page.getByRole('status')).toHaveText('15 de 15 instituciones y unidades');
  await expect(list.getByRole('link')).toHaveCount(0);
  const parent = page.getByRole('article', { name: 'UNAM', exact: true });
  await expect(parent.getByText('2 unidades académicas')).toBeVisible();
  await expect(parent.getByText(/Incluye resultados propios/)).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'UNAM FI', exact: true }).getByText(/Solo resultados/),
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'ITESM MTY', exact: true }).getByText('Logo no disponible'),
  ).toBeVisible();
  const search = page.getByRole('textbox', { name: searchLabel });
  await search.fill('MÉRIDA');
  await expect(page.getByRole('status')).toHaveText('1 de 15 instituciones y unidades');
  await expect(list.getByRole('heading', { name: 'UADY', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe('MÉRIDA');
  await page.reload();
  await expect(search).toHaveValue('MÉRIDA');
  await expect(list.getByRole('article')).toHaveCount(1);
  await search.fill('Escuela Superior de Cómputo');
  await expect(list.getByRole('heading', { name: 'ESCOM', exact: true })).toBeVisible();
  await search.fill('does-not-exist');
  await expect(
    page.getByText('No hay instituciones que coincidan con esta búsqueda.'),
  ).toBeVisible();
  await expect(list).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(page).toHaveURL(directoryUrl);
  await expect(list.getByRole('article')).toHaveCount(15);
  await page.goto(`${directoryUrl}?q=UNAM&q=IPN`);
  await expect(
    page.getByText('La búsqueda contiene parámetros repetidos o desconocidos.'),
  ).toBeVisible();
  await expect(list).toHaveCount(0);
  await page.getByRole('button', { name: 'Restablecer búsqueda' }).click();
  await expect(page).toHaveURL(directoryUrl);
  await expect(list.getByRole('article')).toHaveCount(15);
});

test('uses only real data in production and exposes index navigation without unavailable histories', async ({
  page,
}) => {
  await page.goto('/schools');
  await expect(
    page.getByText('Todavía no hay instituciones publicadas en este archivo.'),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText(/inventados/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Instituciones', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

for (const width of [390, 1024]) {
  test(`opens the school index through navigation at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${origin}/scoreboards`);
    if (width < 900) {
      await page.getByRole('button', { name: 'Abrir navegación' }).click();
    }
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Instituciones', exact: true })
      .click();
    await expect(page).toHaveURL(directoryUrl);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Instituciones a través de cada temporada.',
    );
    await expect(page.getByRole('dialog', { name: 'Menú de navegación' })).not.toBeVisible();
    await expect(page.getByRole('main')).toBeFocused();
    if (width < 900) {
      await page.getByRole('button', { name: 'Abrir navegación' }).click();
    }
    await expect(
      page
        .getByRole('navigation', { name: 'Navegación principal' })
        .getByRole('link', { name: 'Instituciones', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });
}

for (const mode of ['light', 'dark'] as const) {
  test(`school cards reflow with equivalent scoped values and accessible search in ${mode}`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('huron-scoreboards.theme-mode', value);
    }, mode);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${directoryUrl}?q=UNAM`);
    const search = page.getByRole('textbox', { name: searchLabel });
    const cards = page.getByRole('list', { name: 'Instituciones y unidades' });
    await expect(cards.getByRole('article')).toHaveCount(3);
    const original = await cards.textContent();
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
      await expect
        .poll(() =>
          cards.evaluate(
            (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
          ),
        )
        .toBe(width < 600 ? 1 : width < 1200 ? 2 : 3);
      await expect(search).toHaveValue('UNAM');
      await expect.poll(() => cards.textContent()).toBe(original);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        `${mode} ${String(width)}x${String(height)}`,
      ).toBe(true);
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await search.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('ESCOM');
    await expect(search).toBeFocused();
    await expect(cards.getByRole('article')).toHaveCount(1);
    await expect(cards.getByRole('heading', { name: 'ESCOM' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(cards.getByRole('heading', { name: 'ESCOM' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test.describe('touch school search', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('searches and recovers no matches with touch', async ({ page }) => {
    await page.goto(directoryUrl);
    const search = page.getByRole('textbox', { name: searchLabel });
    await search.tap();
    await search.fill('unknown-school');
    const clear = page.getByRole('button', { name: 'Limpiar búsqueda' });
    await clear.tap();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('status')).toHaveText('15 de 15 instituciones y unidades');
  });
});
