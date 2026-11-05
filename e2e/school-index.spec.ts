import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4175';
const directoryUrl = `${origin}/#/schools`;
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
  await expect(list.getByRole('link')).toHaveCount(15);
  await expect(list.getByRole('link', { name: 'UNAM', exact: true })).toHaveAttribute(
    'href',
    '#/schools/unam',
  );
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
  expect(new URL(page.url().split('#')[1], origin).searchParams.get('q')).toBe('MÉRIDA');
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

test('uses the real archive in production and exposes current institution navigation', async ({
  page,
}) => {
  await page.goto('./#/schools');
  await expect(page.getByRole('status')).toHaveText('1067 de 1067 instituciones y unidades');
  await expect(page.getByRole('article', { name: 'CCL', exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('article', { name: 'ESCOM IPN', exact: true })
      .filter({ has: page.locator('a[href="#/schools/ipn-escom"]') }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: searchLabel })).toBeVisible();
  await expect(page.getByText(/inventados/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Instituciones', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('shows one BUAP university and its distinct FCC unit in the published archive', async ({
  page,
}) => {
  await page.goto('./#/schools?q=BUAP');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('status')).toHaveText('2 de 1067 instituciones y unidades');
  await expect(list.getByRole('link', { name: 'BUAP', exact: true })).toHaveAttribute(
    'href',
    '#/schools/buap',
  );
  await list.getByRole('link', { name: 'FCC BUAP', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Facultad de Ciencias de la Computación',
  );
  await page.getByRole('tab', { name: 'Clasificaciones acumuladas' }).click();
  await expect(page.getByText('Esta escuela únicamente', { exact: true })).toBeVisible();
  await expect(page.getByText('voidcode', { exact: true })).toBeVisible();
  await expect(page.getByText('FAAV team', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver institución BUAP', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Benemérita Universidad Autónoma de Puebla',
  );
  await page.getByRole('tab', { name: 'Clasificaciones acumuladas' }).click();
  await expect(page.getByText('Alcance institucional', { exact: true })).toBeVisible();
  await expect(page.getByText('voidcode', { exact: true })).toBeVisible();
  await expect(page.getByText('FAAV team', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver solo resultados directos', exact: true }).click();
  await expect(page.getByText('voidcode', { exact: true })).toHaveCount(0);
  await expect(page.getByText('FAAV team', { exact: true })).toHaveCount(0);
});

test('shows consolidated ESCOM history as a distinct IPN unit in the published archive', async ({
  page,
}) => {
  await page.goto('./#/schools?q=Escuela%20Superior%20de%20C%C3%B3mputo');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 de 1067 instituciones y unidades');
  await list.getByRole('link', { name: 'ESCOM IPN', exact: true }).click();
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Escuela Superior de Cómputo');
  await expect(page.getByText('Esta escuela únicamente', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ver institución IPN', exact: true }),
  ).toHaveAttribute('href', '#/schools/ipn');
  await expect(
    page.getByRole('list', { name: 'Resultados de concursos' }).getByText('Escoders', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver institución IPN', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Instituto Politécnico Nacional',
  );
  await expect(page.getByText('Alcance institucional', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  const results = page.getByRole('list', { name: 'Resultados de concursos' });
  await expect(results.getByText('Escoders', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver solo resultados directos', exact: true }).click();
  await expect(results.getByText('Escoders', { exact: true })).toHaveCount(0);
});

test('publishes consolidated IPN units and a separate UNAM CNYN history', async ({ page }) => {
  for (const [search, name, schoolId] of [
    ['ESFM', 'ESFM IPN', 'ipn-esfm'],
    ['UPIIZ', 'UPIIZ - IPN', 'ipn-upiiz'],
    ['UPIICSA', 'UPIICSA IPN', 'ipn-upiicsa'],
    ['ESIME', 'ESIME Culhuacán', 'ipn-esime-culhuacan'],
    ['ESIME', 'ESIME Azcapotzalco', 'ipn-esime-azcapotzalco'],
  ]) {
    await page.goto(`./#/schools?q=${search}`);
    const list = page.getByRole('list', { name: 'Instituciones y unidades' });
    await expect(list.getByRole('article')).toHaveCount(search === 'ESIME' ? 2 : 1);
    const link = list.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', `#/schools/${schoolId}`);
    await link.click();
    await expect(
      page.getByRole('link', { name: 'Ver institución IPN', exact: true }),
    ).toHaveAttribute('href', '#/schools/ipn');
  }
  await page.goto('./#/schools/unam-cnyn');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Centro de Nanociencias y Nanotecnología',
  );
  await expect(
    page.getByRole('link', {
      name: 'Ver institución UNAM',
      exact: true,
    }),
  ).toHaveAttribute('href', '#/schools/unam');
  await page.getByRole('tab', { name: 'Clasificaciones acumuladas' }).click();
  const accumulated = page.getByText('Hijos de Turing', { exact: true });
  await expect(accumulated).toBeVisible();
  await expect(page.getByText('Sereno el Fullereno - CNyMyN', { exact: true })).toBeVisible();
  await expect(page.getByText('Ángstroms - CNyMyN', { exact: true })).toBeVisible();
  await page.goto('./#/schools/ipn?scope=school');
  await expect(
    page.getByRole('region', { name: 'Resumen del historial' }).locator('dd').first(),
  ).toHaveText('0');
});

test('publishes one record per UNAM unit with correct institutional navigation', async ({
  page,
}) => {
  await page.goto('./#/schools?q=UNAM');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(9);
  await expect(page.getByRole('status')).toHaveText('9 de 1067 instituciones y unidades');
  for (const [name, id] of [
    ['FC UNAM', 'unam-fciencias'],
    ['FI UNAM', 'unam-fi'],
    ['FES Acatlán UNAM', 'unam-fes-acatlan'],
    ['ENES Morelia UNAM', 'unam-enes-morelia'],
    ['FES Cuautitlán UNAM', 'unam-fes-cuautitlan'],
    ['FE UNAM', 'unam-economia'],
    ['CFATA UNAM', 'unam-cfata'],
    ['CNYN UNAM', 'unam-cnyn'],
  ]) {
    await expect(list.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      `#/schools/${id}`,
    );
  }
  await page.goto('./#/schools?q=IIMAS');
  await expect(list.getByRole('article')).toHaveCount(1);
  await expect(list.getByRole('link', { name: 'IIMAS', exact: true })).toHaveAttribute(
    'href',
    '#/schools/unam-iimas',
  );
  await page.goto('./#/schools?q=UNAM');
  await list.getByRole('link', { name: 'FI UNAM', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Ver institución UNAM', exact: true }),
  ).toHaveAttribute('href', '#/schools/unam');
  await expect(page.getByText('Esta escuela únicamente', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver institución UNAM', exact: true }).click();
  await expect(page.getByText('Alcance institucional', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver solo resultados directos', exact: true }).click();
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(
    page
      .getByRole('list', { name: 'Resultados de concursos' })
      .getByText('Bubulubu FI UNAM', { exact: true }),
  ).toBeVisible();
});

test('publishes distinct ITESM campuses and a shared university history', async ({ page }) => {
  await page.goto('./#/schools?q=ITESM');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(19);
  await expect(page.getByRole('status')).toHaveText('19 de 1067 instituciones y unidades');
  for (const [name, id] of [
    ['ITESM CEM', 'itesm-cem'],
    ['ITESM CCM', 'tec-ciudad-de-mexico'],
    ['ITESM CSF', 'tec-santa-fe'],
    ['ITESM Monterrey', 'itesm-monterrey'],
    ['ITESM Querétaro', 'tec-queretaro'],
  ]) {
    await expect(list.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      `#/schools/${id}`,
    );
  }
  await list.getByRole('link', { name: 'ITESM Querétaro', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tecnológico de Monterrey, Campus Querétaro',
  );
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByText('Esta escuela únicamente', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: 'Resultados de concursos' })
      .getByText('lEFTaSaNeXERCISE', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver institución Tec de Monterrey', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Instituto Tecnológico y de Estudios Superiores de Monterrey',
  );
  await expect(page.getByText('Alcance institucional', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver solo resultados directos', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resumen del historial' }).locator('dd').first(),
  ).toHaveText('0');
});

test('publishes one CUCEI unit and includes confirmed CUCEI Extreme in its history', async ({
  page,
}) => {
  await page.goto('./#/schools?q=CUCEI');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 de 1067 instituciones y unidades');
  await list.getByRole('link', { name: 'UdG CUCEI', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Centro Universitario de Ciencias Exactas e Ingenierías',
  );
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByText('Esta escuela únicamente', { exact: true })).toBeVisible();
  const results = page.getByRole('list', { name: 'Resultados de concursos' });
  await expect(results.getByText('CUCEI Extreme', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver institución U de G', exact: true }).click();
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByText('Alcance institucional', { exact: true })).toBeVisible();
  await expect(results.getByText('CUCEI Extreme', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver solo resultados directos', exact: true }).click();
  await expect(results.getByText('CUCEI Extreme', { exact: true })).toHaveCount(0);
  await expect(results.getByText('Los Zermeñitos', { exact: true })).toBeVisible();
});

test('publishes combined UG-CIMAT history without inventing a university parent', async ({
  page,
}) => {
  await page.goto('./#/schools?q=UG-CIMAT');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 de 1067 instituciones y unidades');
  await list.getByRole('link', { name: 'UG-CIMAT', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Universidad de Guanajuato / Centro de Investigación en Matemáticas',
  );
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByRole('link', { name: /^Ver institución / })).toHaveCount(0);
  const results = page.getByRole('list', { name: 'Resultados de concursos' });
  await expect(results.getByText('Manowar', { exact: true }).first()).toBeVisible();
  await expect(results.getByText('OWO', { exact: true }).first()).toBeVisible();
});

test('publishes three consolidated Panamericana campuses with shared institutional history', async ({
  page,
}) => {
  await page.goto('./#/schools?q=Panamericana');
  const list = page.getByRole('list', { name: 'Instituciones y unidades' });
  await expect(list.getByRole('article')).toHaveCount(4);
  await expect(page.getByRole('status')).toHaveText('4 de 1067 instituciones y unidades');
  for (const [name, id] of [
    ['UP', 'up'],
    ['UP Bonaterra', 'up-aguascalientes'],
    ['UP Guadalajara', 'up-guadalajara'],
    ['UP CDMX', 'up-ciudad-de-mexico'],
  ]) {
    await expect(list.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      `#/schools/${id}`,
    );
  }
  await list.getByRole('link', { name: 'UP CDMX', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Universidad Panamericana, Campus Ciudad de México',
  );
  await page.getByRole('tab', { name: 'Clasificaciones acumuladas' }).click();
  await expect(page.getByText('Esta escuela únicamente', { exact: true })).toBeVisible();
  await expect(page.getByText('UPM2', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver institución UP', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Universidad Panamericana');
  await page.getByRole('tab', { name: 'Clasificaciones acumuladas' }).click();
  await expect(page.getByText('Alcance institucional', { exact: true })).toBeVisible();
  await expect(page.getByText('UPM2', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(
    page.getByRole('list', { name: 'Resultados de concursos' }).getByText('qwerty', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver solo resultados directos', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resumen del historial' }).locator('dd').first(),
  ).toHaveText('0');
});

test('filters and sorts school team results with reloadable URL state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${directoryUrl}/unam?scope=institution&tab=contests`);
  const search = page.getByRole('textbox', { name: 'Nombre del equipo', exact: true });
  const season = page.getByRole('combobox', { name: 'Temporada', exact: true });
  const sort = page.getByRole('combobox', { name: 'Ordenar equipos por' });
  const results = page.getByRole('list', { name: 'Resultados de concursos' });
  const summary = page.getByRole('region', { name: 'Resumen del historial' });
  const before = await summary.textContent();
  await search.fill('Alpha');
  await season.selectOption('2024');
  await sort.selectOption('place');
  await expect(page.getByRole('status', { name: 'Recuento de concursos' })).toHaveText(
    '4 de 50 resultados de equipos',
  );
  await expect(results.locator(':scope > li')).toHaveCount(4);
  await expect(results.locator(':scope > li').first()).toContainText('#1');
  await expect(summary).toHaveText(before ?? '');
  await expect(page).toHaveURL(
    `${directoryUrl}/unam?scope=institution&tab=contests&team=Alpha&season=2024&sort=place`,
  );
  await page.reload();
  await expect(search).toHaveValue('Alpha');
  await expect(season).toHaveValue('2024');
  await expect(sort).toHaveValue('place');
  await sort.selectOption('team');
  await sort.selectOption('solved');
  await search.fill('does-not-exist');
  await expect(page.getByText('No hay resultados que coincidan con estos filtros.')).toBeVisible();
  await expect(results).toHaveCount(0);
  await page.getByRole('button', { name: 'Restablecer resultados' }).click();
  await expect(page).toHaveURL(`${directoryUrl}/unam?scope=institution&tab=contests`);
  await expect(page.getByRole('status', { name: 'Recuento de concursos' })).toHaveText(
    '50 de 50 resultados de equipos',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto(`${directoryUrl}/unam?sort=invalid`);
  await expect(page.getByRole('heading', { name: 'Selección no disponible' })).toBeVisible();
});

test('filters and sorts accumulated school results independently with reloadable URLs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `${directoryUrl}/unam?scope=institution&team=Alpha&season=2024&sort=place&tab=accumulated`,
  );
  const search = page.getByRole('textbox', { name: 'Nombre del equipo acumulado' });
  const season = page.getByRole('combobox', { name: 'Temporada acumulada' });
  const sort = page.getByRole('combobox', { name: 'Ordenar acumulados por' });
  const count = page.getByRole('status', { name: 'Recuento de acumulados' });
  const results = page.getByRole('list', { name: 'Resultados acumulados' });
  await expect(count).toHaveText('6 de 6 resultados acumulados');
  await expect(results.getByRole('listitem').first()).toContainText('2025');
  await sort.selectOption('score');
  await expect(
    page.getByText(
      'Los puntajes publicados pueden usar unidades o escalas distintas entre temporadas.',
    ),
  ).toBeVisible();
  await search.fill('Alpha');
  await season.selectOption('2024');
  await expect(count).toHaveText('1 de 6 resultados acumulados');
  await expect(page).toHaveURL(
    `${directoryUrl}/unam?scope=institution&team=Alpha&season=2024&sort=place&tab=accumulated&accumulatedSort=score&accumulatedTeam=Alpha&accumulatedSeason=2024`,
  );
  await page.reload();
  await expect(search).toHaveValue('Alpha');
  await expect(season).toHaveValue('2024');
  await expect(sort).toHaveValue('score');
  await sort.selectOption('place');
  await sort.selectOption('team');
  await expect(results.getByRole('link', { name: 'Ver clasificación' })).toHaveAttribute(
    'href',
    '#/scoreboards?season=2024&series=gpm&view=accumulated',
  );
  await search.fill('does-not-exist');
  await expect(
    page.getByText('No hay clasificaciones acumuladas que coincidan con estos filtros.'),
  ).toBeVisible();
  await expect(results).toHaveCount(0);
  await page.getByRole('button', { name: 'Restablecer acumulados' }).click();
  await expect(page).toHaveURL(
    `${directoryUrl}/unam?scope=institution&team=Alpha&season=2024&sort=place&tab=accumulated`,
  );
  await expect(count).toHaveText('6 de 6 resultados acumulados');
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByRole('status', { name: 'Recuento de concursos' })).toHaveText(
    '4 de 50 resultados de equipos',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('applies global series across school history and persists accessible detail tabs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${directoryUrl}/unam`);
  await expect(page.getByRole('tab', { name: 'Temporadas y podios' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tabpanel', { name: 'Temporadas y podios' })).toBeVisible();
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  const series = page.getByRole('combobox', { name: 'Serie del historial' });
  const summary = page.getByRole('region', { name: 'Resumen del historial' });
  const resultsCount = summary
    .getByText('Resultados de equipos', { exact: true })
    .locator('..')
    .locator('dd');
  await series.selectOption('mexico-finals');
  await expect(resultsCount).toHaveText('6');
  await expect(page.getByRole('status', { name: 'Recuento de concursos' })).toHaveText(
    '6 de 6 resultados de equipos',
  );
  await page.getByRole('tab', { name: 'Clasificaciones acumuladas' }).click();
  await expect(
    page.getByText('No hay clasificaciones acumuladas publicadas para la serie seleccionada.'),
  ).toBeVisible();
  await series.selectOption('gpm-accumulated');
  await expect(resultsCount).toHaveText('0');
  await expect(page.getByRole('status', { name: 'Recuento de acumulados' })).toHaveText(
    '6 de 6 resultados acumulados',
  );
  await expect(
    page.getByRole('img', { name: /Tendencia del mejor puesto por temporada/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Participación y problemas resueltos' }),
  ).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Resultados de concursos' })).toHaveCount(0);
  await expect(page).toHaveURL(`${directoryUrl}/unam?tab=accumulated&series=gpm-accumulated`);
  await page.reload();
  await expect(series).toHaveValue('gpm-accumulated');
  await expect(page.getByRole('tabpanel', { name: 'Clasificaciones acumuladas' })).toBeVisible();
  await page.getByRole('tab', { name: 'Temporadas y podios' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Temporadas y podios' })).toBeVisible();
  await series.selectOption('gpm-qualifiers');
  await expect(resultsCount).toHaveText('44');
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByRole('status', { name: 'Recuento de concursos' })).toHaveText(
    '44 de 44 resultados de equipos',
  );
  await series.selectOption('all');
  await expect(resultsCount).toHaveText('50');
  await page.getByRole('tab', { name: 'Temporadas y podios' }).click();
  await expect(page).toHaveURL(`${directoryUrl}/unam`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('includes ESCOM accumulated wins in seasonal trends and expands all podiums', async ({
  page,
}) => {
  await page.goto('./#/schools/ipn-escom');
  const chart = page.getByRole('img', { name: /Tendencia del mejor puesto por temporada/ });
  await expect(chart.locator('[data-season="2020"]')).toHaveAttribute('data-place', '1');
  const podiums = page.getByRole('list', { name: 'Podios destacados' });
  await expect(podiums.getByRole('listitem')).toHaveCount(5);
  await expect(podiums.getByText('Escuela Superior de Comedia', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver todos', exact: true }).click();
  await expect(podiums.getByRole('listitem')).toHaveCount(31);
  const comedia = podiums.getByRole('listitem').filter({ hasText: 'Escuela Superior de Comedia' });
  await expect(comedia).toContainText('2020 · Puesto #1');
  await expect(comedia.getByRole('link')).toHaveAttribute(
    'href',
    '#/scoreboards?season=2020&series=gpm&view=accumulated',
  );
  await expect(comedia.getByRole('alert')).toContainText('no confirmado como final');
  await page.getByRole('button', { name: 'Ver menos', exact: true }).click();
  await expect(podiums.getByRole('listitem')).toHaveCount(5);
});

test('counts qualifier, Mexico Finals and accumulated podiums in school history', async ({
  page,
}) => {
  await page.goto(`${directoryUrl}/unam`);
  const statistics = page.getByRole('region', { name: 'Resumen del historial' });
  await expect(
    statistics.getByText('Podios', { exact: true }).locator('..').locator('dd'),
  ).toHaveText('26');
  await page.getByRole('tab', { name: 'Temporadas y podios' }).click();
  const seasons = page.locator('section', {
    has: page.getByRole('heading', { name: 'Temporadas y podios', exact: true }),
  });
  await expect(seasons.getByText(/7 podios/)).toBeVisible();
  await expect(seasons.getByText(/8 podios/)).toBeVisible();
  await page.goto(`${directoryUrl}/unam-fi`);
  const podiums = page.getByRole('list', { name: 'Podios destacados' });
  const accumulated = podiums.getByRole('link', {
    name: 'GPM 2025 · Clasificación acumulada',
    exact: true,
  });
  await expect(accumulated).toHaveAttribute(
    'href',
    '#/scoreboards?season=2025&series=gpm&view=accumulated',
  );
  await accumulated.click();
  await expect(page).toHaveURL(`${origin}/#/scoreboards?season=2025&series=gpm&view=accumulated`);
});

test('opens unit and institution histories with the correct scope and contest destination', async ({
  page,
}) => {
  await page.goto(directoryUrl);
  await page.getByRole('link', { name: 'UNAM', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/#/schools/unam`);
  await expect(page.getByText('Alcance institucional')).toBeVisible({ timeout: 15_000 });
  const stats = page.getByRole('region', { name: 'Resumen del historial' });
  await expect(stats.getByText('50', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Tendencia del mejor puesto por temporada' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver solo resultados directos' }).click();
  await expect(page).toHaveURL(`${origin}/#/schools/unam?scope=school`);
  await expect(
    page.getByRole('region', { name: 'Resumen del historial' }).locator('dd').first(),
  ).toHaveText('0');
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(
    page.getByText('Esta escuela todavía no tiene resultados de concursos publicados.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Todas las instituciones' }).click();
  await page.getByRole('link', { name: 'UNAM FI', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/#/schools/unam-fi`);
  await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
  await expect(page.getByText('Esta escuela únicamente')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver institución UNAM' })).toHaveAttribute(
    'href',
    '#/schools/unam',
  );
  await expect(page.getByRole('link', { name: 'Contest' })).toHaveCount(0);
  const contestResults = page.getByRole('list', { name: 'Resultados de concursos' });
  const targetContest = contestResults.getByRole('link', {
    name: 'GPM 2024 Clasificatorio 1',
    exact: true,
  });
  await expect(targetContest).toHaveCount(2);
  await targetContest.first().click();
  await expect(page).toHaveURL(`${origin}/#/scoreboards?contest=2024-gpm-qualifier-1`);
  const contestHeading = page.getByRole('heading', {
    name: 'GPM 2024 Clasificatorio 1',
    exact: true,
  });
  await expect(contestHeading.first()).toBeVisible({ timeout: 15_000 });
});

for (const width of [390, 1024]) {
  test(`opens the school index through navigation at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${origin}/#/scoreboards`);
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
  test(`school histories preserve chart, roster and contest data across viewports in ${mode}`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('huron-scoreboards.theme-mode', value);
    }, mode);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${origin}/#/schools/unam-fi`);
    await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
    const results = page.getByRole('list', { name: 'Resultados de concursos' });
    await expect(results.locator(':scope > li').first()).toBeVisible();
    const original = await results.textContent();
    const chart = page.getByRole('img', { name: /Tendencia del mejor puesto por temporada/ });
    await expect(chart).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Participación y problemas resueltos' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mejores puestos' })).toBeVisible();
    await page.getByRole('tab', { name: 'Temporadas y podios' }).click();
    await expect(page.getByText(/Cada participación cuenta una fila de un equipo/)).toBeVisible();
    await page.getByRole('tab', { name: 'Resultados por concursos' }).click();
    const stats = page.getByRole('region', { name: 'Resumen del historial' });
    const count = await results.locator(':scope > li').count();
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
      await expect(results.locator(':scope > li')).toHaveCount(count);
      await expect.poll(() => results.textContent()).toBe(original);
      await expect(chart).toBeVisible();
      await expect(stats).toBeVisible();
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
    const firstRoster = results.locator('details').first();
    if ((await firstRoster.count()) > 0) {
      await firstRoster.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(firstRoster).toHaveAttribute('open', '');
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(chart).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
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
    await page.evaluate(() => document.fonts.ready);
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
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }),
      );
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
