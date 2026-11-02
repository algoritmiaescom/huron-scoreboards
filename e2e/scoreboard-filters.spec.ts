import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4175';
const contestId = '2024-gpm-qualifier-1';
const contestUrl = `${origin}/#/scoreboards?contest=${contestId}`;

test.beforeEach(async ({ page }) => {
  await page.route('https://example.com/**', (route) => route.abort());
});

for (const width of [390, 1440]) {
  test(`loads partial mock history through the archive at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/#/scoreboards?contest=2023-gpm-qualifier-1`);
    await expect(page.getByText('Fecha desconocida', { exact: true })).toBeVisible();
    await expect(page.getByText('Duración desconocida', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Regla de penalización desconocida', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Problemas desconocidos', { exact: true })).toBeVisible();
    const totals = page.getByRole(width < 900 ? 'list' : 'table', {
      name: 'Clasificación de GPM 2023 Clasificatorio 1',
    });
    await expect(totals.locator(width < 900 ? ':scope > li' : 'tbody tr')).toHaveCount(12);
    await expect(totals.locator(width < 900 ? ':scope > li' : 'tbody tr').first()).toContainText(
      '919 min',
    );
    await expect(page.getByRole('img', { name: /Problema/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Resuelto', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('9 de 12 equipos');
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('9 de 12 equipos');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goto(
      `${origin}/#/scoreboards?contest=2023-gpm-qualifier-2&school=unam-fc&accepted=1`,
    );
    await expect(page.getByRole('status')).toContainText('1 de ');
    await expect(page.getByText('Desconocida', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /Problema A. Detalle no disponible/ })).toHaveCount(
      1,
    );
    await expect(page.getByRole('img', { name: /primero en resolver/ })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Problema', exact: true }).selectOption('A');
    await expect(page.getByText('No hay equipos que coincidan con estos filtros.')).toBeVisible();
  });
}

test('discovers sparse seasons and series and exposes honest source and correction actions', async ({
  page,
}) => {
  await page.goto(contestUrl);
  await page.getByRole('combobox', { name: 'Temporada' }).selectOption('2023');
  await expect(page.getByRole('combobox', { name: 'Temporada' })).toHaveValue('2023');
  await page.getByRole('combobox', { name: 'Serie', exact: true }).selectOption('gpm');
  const stages = page.getByRole('combobox', { name: 'Clasificación', exact: true });
  await expect(stages.locator('option:not([disabled])')).toHaveCount(2);
  await expect(stages.locator('option', { hasText: 'Repechaje' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Serie', exact: true }).selectOption('mexico-finals');
  await expect(page.getByRole('heading', { name: 'Final Regional Mexicana 2023' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fuente de ejemplo' })).toHaveAttribute(
    'href',
    'https://example.com/huron-scoreboards/mock-data',
  );
  await expect(page.getByText(/resultados inventados/)).toBeVisible();
  await page.getByRole('link', { name: 'Cómo corregir estos datos' }).click();
  await expect(page).toHaveURL(`${origin}/#/contribute`);
});

test('filters the actual contest, shares its URL, and restores reload and history state', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.goto(contestUrl);
  const table = page.getByRole('table', { name: 'Clasificación de GPM 2024 Clasificatorio 1' });
  await expect(table).toBeVisible();
  const total = await table.locator('tbody tr').count();
  await page.getByRole('combobox', { name: 'Problema', exact: true }).selectOption('A');
  await expect(table.locator('tbody tr')).toHaveCount(total);
  const name = page.getByRole('textbox', { name: 'Nombre del equipo' });
  await name.fill('UNAM FC delta');
  await page.getByRole('combobox', { name: 'Institución', exact: true }).selectOption('unam-fc');
  await page.getByRole('button', { name: 'Resuelto', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(`1 de ${String(total)} equipos`);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr').first()).toContainText('#1');
  await expect(table.getByRole('columnheader', { name: 'Problema K' })).toHaveCount(1);
  const filteredUrl = page.url();
  await page.getByRole('button', { name: 'Compartir vista' }).click();
  await expect(page.getByText('Enlace copiado')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(filteredUrl);
  await page.reload();
  await expect(name).toHaveValue('UNAM FC delta');
  await expect(page.getByRole('button', { name: 'Resuelto', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page
    .getByRole('combobox', { name: 'Clasificación', exact: true })
    .selectOption('2024-gpm-qualifier-2');
  await expect(page).toHaveURL(`${origin}/#/scoreboards?contest=2024-gpm-qualifier-2`);
  await expect(name).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(name).toHaveValue('UNAM FC delta');
  await page.goForward();
  await expect(name).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(page.getByRole('combobox', { name: 'Problema', exact: true })).toHaveValue('A');
  await page.getByRole('button', { name: 'Quitar filtro Equipo: UNAM FC delta' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveValue('');
  expect(new URL(page.url().split('#')[1], origin).searchParams.has('team')).toBe(false);
  expect(new URL(page.url().split('#')[1], origin).searchParams.get('problem')).toBe('A');
  await page.getByRole('button', { name: 'Limpiar todo' }).click();
  await expect(page).toHaveURL(contestUrl);
  await expect(page.getByText('Vista filtrada')).not.toBeVisible();
});

test('explains invalid filters, empty matches, and missing contests without substituting results', async ({
  page,
}) => {
  await page.goto(`${contestUrl}&problem=Z&first=0`);
  await expect(page.getByText('El problema "Z" no pertenece a este concurso.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Quitar filtro problem', exact: true }).click();
  await expect(page).toHaveURL(`${contestUrl}&first=0`);
  await page.getByRole('button', { name: 'Quitar filtro first', exact: true }).click();
  await expect(page).toHaveURL(contestUrl);
  await page.getByRole('textbox', { name: 'Nombre del equipo' }).fill('nonexistent-team');
  await expect(page.getByText('No hay equipos que coincidan con estos filtros.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.goto(`${origin}/#/scoreboards?contest=not-a-contest`);
  await expect(page.getByRole('alert')).toContainText('No existe un concurso');
  await page.getByRole('button', { name: 'Ver el último concurso' }).click();
  await expect(page.getByRole('table')).toBeVisible();
});

for (const failure of ['missing', 'rejected'] as const) {
  test(`offers a selectable shared URL when clipboard is ${failure}`, async ({ page }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value:
          mode === 'missing'
            ? undefined
            : {
                writeText: () => Promise.reject(new Error('Permission denied')),
              },
      });
    }, failure);
    await page.goto(`${contestUrl}&school=unam-fc`);
    await page.getByRole('button', { name: 'Compartir vista' }).click();
    const dialog = page.getByRole('dialog', { name: 'Compartir clasificación' });
    await expect(dialog).toBeVisible();
    const url = dialog.getByRole('textbox', { name: 'Enlace para compartir' });
    await expect(url).toHaveValue(page.url());
    await url.focus();
    expect(
      await url.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    ).toBe(page.url());
    await expect(page.getByText('Enlace copiado')).not.toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Compartir vista' })).toBeFocused();
  });
}

for (const mode of ['light', 'dark'] as const) {
  test(`filtered standings preserve controls, semantics and contained scrolling in ${mode}`, async ({
    page,
  }) => {
    await page.addInitScript((themeMode) => {
      localStorage.setItem('huron-scoreboards.theme-mode', themeMode);
    }, mode);
    await page.goto(`${contestUrl}&team=UNAM&problem=A&accepted=1`);
    await expect(page.getByRole('status')).toContainText('equipos');
    const getDescriptions = () =>
      page
        .getByRole('img', { name: /Problema/ })
        .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('aria-label')));
    const descriptions = await getDescriptions();
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
      await expect(page.getByRole('table')).toHaveCount(width < 900 ? 0 : 1);
      await expect(page.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveValue('UNAM');
      await expect(page.getByRole('combobox', { name: 'Problema', exact: true })).toHaveValue('A');
      await expect.poll(getDescriptions).toEqual(descriptions);
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(dimensions.content, `${mode} ${String(width)}x${String(height)}`).toBeLessThanOrEqual(
        dimensions.viewport,
      );
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    const region = page.getByRole('region', { name: 'Clasificación con desplazamiento' });
    await region.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const table = page.getByRole('table');
    const sticky = await table
      .locator('tbody tr')
      .first()
      .locator('th, td')
      .evaluateAll((cells) =>
        cells.slice(0, 3).map((cell) => {
          const box = cell.getBoundingClientRect();
          return { left: box.left, right: box.right };
        }),
      );
    expect(sticky[1].left).toBeCloseTo(sticky[0].right, 0);
    expect(sticky[2].left).toBeCloseTo(sticky[1].right, 0);
    const lastProblem = table.getByRole('img', { name: /Problema K/ }).first();
    await lastProblem.focus();
    await expect(lastProblem).toBeInViewport();
    const focus = await lastProblem.boundingBox();
    expect(focus?.x).toBeGreaterThanOrEqual(sticky[2].right);
    await page.setViewportSize({ width: 640, height: 900 });
    await expect(page.getByRole('table')).toHaveCount(0);
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

test.describe('touch filters', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('filters and removes chips by touch without losing problem details', async ({ page }) => {
    await page.goto(contestUrl);
    const toggle = page.getByRole('button', { name: 'Primero en resolver', exact: true });
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page
      .getByRole('img', { name: /primero en resolver/ })
      .first()
      .tap();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.getByRole('button', { name: 'Quitar filtro Primero en resolver' }).tap();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(contestUrl);
  });
});
