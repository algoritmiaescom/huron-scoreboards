import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('navigates the complete page, restores its theme, and recovers unknown routes', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Contribuir' })
    .click();
  await expect(page).toHaveURL('./#/contribute');
  await expect(page).toHaveTitle('Contribuir | Huron Scoreboards');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('link', { name: 'Contribuir', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '¿Encontraste un error? Corrígelo desde la fuente.',
  );
  await expect(page.getByRole('link', { name: 'Guía de contribución' })).toHaveAttribute(
    'href',
    /\/blob\/main\/CONTRIBUTING.md$/,
  );
  await expect(page.getByRole('link', { name: 'Abrir el repositorio de GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/algoritmiaescom/huron-scoreboards',
  );
  await expect(page.getByText(/Los enlaces de esta guía son/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Cambiar al tema oscuro', exact: true }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 24, 35)');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Cambiar al tema claro', exact: true }),
  ).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 24, 35)');
  await page.goto('./#/does-not-exist');
  await expect(page).toHaveTitle('Página no encontrada | Huron Scoreboards');
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(
    page.getByRole('heading', { name: 'Gran Premio MX 2026 — Tercera Fecha' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main')).toBeFocused();
});

test('opens archived multimedia from desktop and mobile navigation', async ({ page }) => {
  await page.goto('./#/scoreboards');
  await page.getByRole('link', { name: 'Multimedia', exact: true }).click();
  await expect(page).toHaveURL('./#/media');
  await expect(page).toHaveTitle('Comunidad | Huron Scoreboards');
  await expect(page.getByRole('heading', { name: 'Más allá de la clasificación.' })).toBeVisible();
  await expect(page.getByText(/Final Mexicana 2026 ·/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Multimedia', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText(/no consulta redes sociales en vivo/)).toBeVisible();
  await expect(page.getByRole('article').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menú de navegación' });
  await drawer.getByRole('link', { name: 'Clasificaciones', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveURL('./#/scoreboards?contest=2026-gpm-qualifier-3');
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await drawer.getByRole('link', { name: 'Multimedia', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveURL('./#/media');
});

for (const mode of ['light', 'dark'] as const) {
  test(`browses previous mock contest media in ${mode} and reloads the selection`, async ({
    page,
  }) => {
    await page.addInitScript((themeMode) => {
      localStorage.setItem('huron-scoreboards.theme-mode', themeMode);
    }, mode);
    await page.clock.setFixedTime(new Date('2026-11-02T12:00:00Z'));
    await page.goto('http://127.0.0.1:4175/#/media');
    const picker = page.getByLabel('Ver publicaciones de otro evento');
    await expect(picker).toBeVisible();
    await picker.selectOption('2024-gpm-repechage');

    await expect(page).toHaveURL('http://127.0.0.1:4175/#/media?event=2024-gpm-repechage');
    await expect(
      page.getByText('Publicados los resultados del repechaje 2024. Nos vemos en la final.'),
    ).toBeVisible();
    await expect(picker).toHaveValue('2024-gpm-repechage');

    for (const width of [320, 390, 599, 600, 899, 900, 1200, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByLabel('Ver publicaciones de otro evento')).toHaveValue(
        '2024-gpm-repechage',
      );
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            ),
          { message: `${mode} ${String(width)}px media overflow` },
        )
        .toBe(true);
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }

    await page.reload();
    await expect(page.getByLabel('Ver publicaciones de otro evento')).toHaveValue(
      '2024-gpm-repechage',
    );
    await expect(
      page.getByText('Publicados los resultados del repechaje 2024. Nos vemos en la final.'),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL('http://127.0.0.1:4175/#/media');
    await expect(page.getByLabel('Ver publicaciones de otro evento')).toHaveValue(
      '2025-mexico-finals',
    );
  });
}

test('supports skip links, trapped drawer focus, Escape and navigation on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/scoreboards');
  await expect(
    page.getByRole('heading', { name: 'Gran Premio MX 2026 — Tercera Fecha' }),
  ).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  const currentURL = page.url();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  expect(page.url()).toBe(currentURL);
  const open = page.getByRole('button', { name: 'Abrir navegación', includeHidden: true });
  await open.click();
  const drawer = page.getByRole('dialog', { name: 'Menú de navegación' });
  await expect(drawer).toBeVisible();
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  const close = drawer.getByRole('button', { name: 'Cerrar navegación' });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Contribuir' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(open).toBeFocused();
  await open.click();
  await drawer.getByRole('link', { name: 'Contribuir' }).click();
  await expect(page).toHaveURL('./#/contribute');
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('button', { name: 'Cambiar al tema oscuro', exact: true }).click();
  await open.click();
  await close.click();
  await expect(open).toBeFocused();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(open).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Contribuir', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(
    page.getByRole('button', { name: 'Cambiar al tema claro', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(drawer).not.toBeVisible();
});

for (const mode of ['light', 'dark'] as const) {
  test(`reflows every released route and verifies accessibility in ${mode}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript((themeMode) => {
      localStorage.setItem('huron-scoreboards.theme-mode', themeMode);
    }, mode);
    for (const route of [
      './#/scoreboards?contest=2022-gpm-repechage',
      './#/media',
      './#/contribute',
      './#/unknown',
    ]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
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
        await expect(page.getByRole('button', { name: 'Abrir navegación' })).toHaveCount(
          width < 900 ? 1 : 0,
        );
        const layout = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        expect(
          layout.content,
          `${mode} ${route} ${String(width)}x${String(height)}`,
        ).toBeLessThanOrEqual(layout.viewport);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('main')).toHaveCount(1);
      }
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
    }
  });
}

test('keeps mobile navigation usable in short landscape and across a desktop resize', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('./#/contribute');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menú de navegación' });
  await expect(drawer.getByRole('button', { name: 'Cerrar navegación' })).toBeInViewport();
  await expect(drawer.getByRole('link', { name: 'Contribuir' })).toBeInViewport();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(drawer).not.toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(drawer).not.toBeVisible();
});

test('announces loading while a page chunk is pending', async ({ page }) => {
  let releaseRequest: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  if (releaseRequest === undefined) {
    throw new Error('Expected an initialized request gate');
  }
  const release = releaseRequest;
  await page.route('**/assets/ContributePage-*.js', async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('./');
  await page.getByRole('link', { name: 'Contribuir', exact: true }).click();
  try {
    await expect(page.getByRole('status')).toContainText('Cargando página');
    await expect(page.getByRole('main')).toBeFocused();
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '¿Encontraste un error? Corrígelo desde la fuente.',
  );
});

test('surfaces a failed page chunk and reloads successfully on retry', async ({ page }) => {
  await page.goto('./');
  await page.route('**/assets/ContributePage-*.js', (route) => route.abort('failed'));
  await page.getByRole('link', { name: 'Contribuir', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No pudimos cargar esta página' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Ocurrió un error');
  await expect(page).toHaveTitle('Error al cargar | Huron Scoreboards');
  await page.unroute('**/assets/ContributePage-*.js');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '¿Encontraste un error? Corrígelo desde la fuente.',
  );
  await expect(page).toHaveTitle('Contribuir | Huron Scoreboards');
});

test.describe('touch navigation', () => {
  test.use({ hasTouch: true });

  test('opens and closes navigation and changes themes with touch', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await page.getByRole('button', { name: 'Abrir navegación' }).tap();
    await page.getByRole('dialog').getByRole('link', { name: 'Contribuir' }).tap();
    await expect(page).toHaveURL('./#/contribute');
    await page.getByRole('button', { name: 'Cambiar al tema oscuro', exact: true }).tap();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 24, 35)');
    await page.getByRole('button', { name: 'Abrir navegación' }).tap();
    await page.getByRole('button', { name: 'Cerrar navegación' }).tap();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

for (const mode of ['light', 'dark'] as const) {
  test(`keeps footer actions readable with enlarged text in ${mode}`, async ({ page }) => {
    await page.addInitScript((themeMode) => {
      localStorage.setItem('huron-scoreboards.theme-mode', themeMode);
    }, mode);
    await page.goto('./#/contribute');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Repositorio en GitHub' })).toBeVisible();
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = '200%';
      await document.fonts.ready;
    });

    for (const width of [320, 600, 640]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(
          () =>
            footer.evaluate(
              (element) =>
                document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
                element.scrollWidth <= element.clientWidth &&
                [...element.querySelectorAll('a')].every(
                  (link) => link.scrollWidth <= link.clientWidth,
                ),
            ),
          { message: `${mode} ${String(width)}px footer actions overflow at 200% text` },
        )
        .toBe(true);
    }
  });
}

test('preserves focus rings, reduced motion, and enlarged-text reflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/contribute');
  const action = page.getByRole('link', { name: 'Abrir el repositorio de GitHub', exact: true });
  await action.focus();
  const focus = await action.evaluate((element) => ({
    outline: getComputedStyle(element).outlineWidth,
    animation: getComputedStyle(document.querySelector('#main-content > *') ?? element)
      .animationDuration,
  }));
  expect(focus.outline).toBe('3px');
  expect(focus.animation).toBe('1e-05s');
  await page.setViewportSize({ width: 640, height: 450 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});
