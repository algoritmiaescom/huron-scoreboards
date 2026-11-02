import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('serves shared hash links and assets under the Pages prefix', async ({ page, baseURL }) => {
  if (baseURL === undefined) {
    throw new Error('Expected the production preview URL');
  }
  const outsideBase: string[] = [];
  const failedResponses: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin === new URL(baseURL).origin) {
      if (!request.url().startsWith(baseURL)) {
        outsideBase.push(request.url());
      }
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(response.url());
    }
  });
  const response = await page.goto('./#/contribute');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Contribuir | Huron Scoreboards');
  await page.reload();
  await expect(page).toHaveTitle('Contribuir | Huron Scoreboards');
  const sharedURL = page.url();
  await page.getByRole('link', { name: 'Saltar al contenido' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  expect(page.url()).toBe(sharedURL);
  await page.getByRole('link', { name: 'Clasificaciones', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Gran Premio MX 2026 — Tercera Fecha' }),
  ).toBeVisible({ timeout: 30_000 });
  for (const name of ['Huron Scoreboards, inicio', 'ICPC Masters México']) {
    await expect
      .poll(() =>
        page.getByRole('img', { name, exact: true }).evaluate((image: HTMLImageElement) => {
          return image.complete && image.naturalWidth > 0;
        }),
      )
      .toBe(true);
  }
  expect(outsideBase).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('redirects to the production archive and renders the reviewed contest accessibly', async ({
  page,
}) => {
  await page.goto('./');

  await expect(
    page.getByRole('heading', { name: 'Gran Premio MX 2026 — Tercera Fecha' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL('./#/scoreboards?contest=2026-gpm-qualifier-3');
  await page.goto('./#/scoreboards?contest=2022-gpm-repechage');
  await expect(page.getByRole('heading', { name: 'Repechaje Gran Premio MX 2022' })).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Clasificación de Repechaje Gran Premio MX 2022' })
      .getByRole('row'),
  ).toHaveCount(164);

  const accessibilityScanResults = await new AxeBuilder({ page }).exclude('table').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test('preserves unidentified schools and published totals in the 2023 repechage', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./#/scoreboards?contest=2023-gpm-repechage');
  await expect(page.getByRole('heading', { name: 'Repechaje Gran Premio MX 2023' })).toBeVisible({
    timeout: 60_000,
  });

  const table = page.getByRole('table', {
    name: 'Clasificación de Repechaje Gran Premio MX 2023',
  });
  await expect(table.getByRole('row')).toHaveCount(1158);
  const unidentified = table.getByRole('row').filter({ hasText: 'LazyDevelopments []' });
  await expect(unidentified.getByText('Institución no identificada')).toBeVisible();
  const totalsOnly = table.getByRole('row').filter({ hasText: 'Zimbros Ziguezagueantes' });
  await expect(
    totalsOnly.getByRole('img', { name: /Problema A\. Detalle no disponible/ }),
  ).toBeVisible();
});

test('loads all 2026 GPM qualifiers and discloses the third table coverage limitation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [stage, name, count] of [
    ['qualifier-1', 'Primera Fecha', 602],
    ['qualifier-2', 'Segunda Fecha', 702],
    ['qualifier-3', 'Tercera Fecha', 611],
  ] as const) {
    await page.goto(`./#/scoreboards?contest=2026-gpm-${stage}`);
    const table = page.getByRole('table', {
      name: `Clasificación de Gran Premio MX 2026 — ${name}`,
    });
    await expect(table.getByRole('row')).toHaveCount(count);
    if (stage === 'qualifier-3') {
      await expect(table.getByRole('columnheader', { name: /^Problema / })).toHaveCount(0);
      await expect(
        page
          .getByRole('alert')
          .filter({ hasText: 'no se puede confirmar si faltan otros equipos' }),
      ).toBeVisible();
      await expect(page.locator('time[datetime="2026-08-29"]')).toBeVisible();
      const leader = table.getByRole('row').filter({ hasText: 'Domain Expansion' });
      await expect(leader.getByRole('cell', { name: '1047 min', exact: true })).toBeVisible();
    } else {
      await expect(table.getByRole('columnheader', { name: /^Problema / })).toHaveCount(12);
    }
  }
});

test('preserves all 2026 accumulated scores and only explicit quota assignments', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./#/scoreboards?contest=2026-gpm-qualifier-3');
  await page
    .getByRole('combobox', { name: 'Clasificación', exact: true })
    .selectOption('accumulated');
  await expect(page).toHaveURL('./#/scoreboards?season=2026&series=gpm&view=accumulated');
  const table = page.getByRole('table', { name: 'Clasificación acumulada 2026' });
  await expect(table.getByRole('row')).toHaveCount(615);
  await expect(table.getByRole('cell', { name: '#510', exact: true })).toHaveCount(105);
  await expect(table.getByRole('cell', { name: '0', exact: true })).toHaveCount(105);
  await expect(table.getByText('Clasificado', { exact: true })).toHaveCount(70);
  await expect(table.getByText('Clasificación desconocida', { exact: true })).toHaveCount(544);
  await expect(table.locator('[data-cut="true"]')).toHaveCount(0);
  const leader = table.getByRole('row').filter({ hasText: 'Oasis' });
  await expect(leader.getByRole('cell', { name: '435', exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '71 cupos' })).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'La fuente no confirma explícitamente' }),
  ).toBeVisible();
  await page.reload();
  await expect(table.getByRole('row')).toHaveCount(615);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByRole('list', { name: 'Clasificación acumulada 2026' });
  await expect(mobile.getByText('Puesto #510', { exact: true })).toHaveCount(105);
  await expect(mobile.getByText('Clasificado', { exact: true })).toHaveCount(70);
});

test('loads the complete 2019 and 2020 Mexico Finals from the real archive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./#/scoreboards?contest=2019-mexico-finals-final');
  await expect(page.getByRole('heading', { name: 'Final Regional de México 2019' })).toBeVisible();

  const finals2019 = page.getByRole('table', {
    name: 'Clasificación de Final Regional de México 2019',
  });
  await expect(finals2019.getByRole('row')).toHaveCount(369);
  const unidentified = finals2019.getByRole('row').filter({ hasText: 'Leones(0,0,0); []' });
  await expect(unidentified.getByText('Institución no identificada')).toBeVisible();

  await page.goto('./#/scoreboards?contest=2020-mexico-finals-final');
  await expect(page.getByRole('heading', { name: 'Final Regional de México 2020' })).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Clasificación de Final Regional de México 2020' })
      .getByRole('row'),
  ).toHaveCount(303);
});

test('labels the unconfirmed 2019 GPM accumulated snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./#/scoreboards?season=2019&series=gpm&view=accumulated');

  const snapshotWarning = page
    .getByRole('alert')
    .filter({ hasText: 'Acumulado hasta la tercera fecha' });
  await expect(snapshotWarning).toContainText('Acumulado hasta la tercera fecha');
  await expect(snapshotWarning).toContainText(
    'La fuente no confirma explícitamente que sea el resultado final.',
  );
  const standing = page.getByRole('table', { name: 'Clasificación acumulada 2019' });
  await expect(standing.getByRole('row')).toHaveCount(383);
  await expect(
    standing.getByRole('columnheader', { name: 'Puntaje publicado (Puntos)' }),
  ).toBeVisible();
});

test('preserves dense 2015 ties and distinct 2024 registrations in the published archive', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./#/scoreboards?season=2015&series=gpm&view=accumulated');
  const dense = page.getByRole('table', { name: 'Clasificación acumulada 2015' });
  await expect(dense.getByRole('row')).toHaveCount(307);
  await expect(dense.getByRole('cell', { name: '#239', exact: true })).toHaveCount(51);
  await expect(dense.getByRole('row').filter({ hasText: 'FGZ' })).toHaveCount(2);
  await expect(page.getByRole('alert').filter({ hasText: 'puestos densos' })).toBeVisible();
  await page.goto('./#/scoreboards?season=2024&series=gpm&view=accumulated');
  const modern = page.getByRole('table', { name: 'Clasificación acumulada 2024' });
  await expect(modern.getByRole('row')).toHaveCount(483);
  for (const name of ['GooseFarmers', 'Timbits']) {
    await expect(modern.getByRole('row').filter({ hasText: name })).toHaveCount(2);
  }
  await page.goto('./#/scoreboards?season=2023&series=gpm&view=accumulated');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Acumulado hasta la segunda fecha' }),
  ).toBeVisible();
});

test('shows every 2013 Finals row without inventing missing places on desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./#/scoreboards?contest=2013-mexico-finals-final');
  const results = page.getByRole('table', { name: /Clasificación de The 2013/ });
  await expect(results.getByRole('row')).toHaveCount(175);
  await expect(results.getByRole('cell', { name: 'No publicado', exact: true })).toHaveCount(81);
  await expect(results.getByRole('cell', { name: '#13', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('alert').filter({ hasText: 'no publica el puesto 13' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByRole('list', { name: /Clasificación de The 2013/ });
  await expect(mobile.getByText('Puesto no publicado', { exact: true })).toHaveCount(81);
});

test('shows an honest empty media archive in production', async ({ page }) => {
  await page.goto('./#/media');
  await expect(page).toHaveTitle('Comunidad | Huron Scoreboards');
  await expect(
    page.getByRole('heading', { name: 'Aún no hay publicaciones archivadas' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByLabel('Ver publicaciones de otra competencia')).toHaveCount(0);
  await expect(page.getByText(/inventados/)).toHaveCount(0);
  await expect(page.getByText(/no consulta redes sociales en vivo/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('restores a saved theme across reloads', async ({ page }) => {
  await page.goto('./');
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

  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Gran Premio MX 2026 — Tercera Fecha' }),
  ).toBeVisible({ timeout: 30_000 });
  await page.goto('./#/scoreboards?contest=2022-gpm-repechage');
  await expect(page.getByRole('heading', { name: 'Repechaje Gran Premio MX 2022' })).toBeVisible();

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

test('reflows the real contest across the responsive verification matrix', async ({ page }) => {
  await page.goto('./#/scoreboards?contest=2022-gpm-repechage');
  const heading = page.getByRole('heading', { name: 'Repechaje Gran Premio MX 2022' });
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
    await heading.scrollIntoViewIfNeeded();
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
