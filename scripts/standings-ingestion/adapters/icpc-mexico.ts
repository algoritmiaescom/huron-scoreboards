import { parse } from 'parse5';

import type { DefaultTreeAdapterTypes } from 'parse5';

const CONTESTS_ORIGIN = 'https://www.icpcmexico.org';
const INDEX_URL = `${CONTESTS_ORIGIN}/contests`;

export type ICPCMexicoDiscovery =
  | {
      status: 'recognized';
      kind: 'gpm-season';
      seasonYear: number;
      sourceEditionLabel: string;
      url: string;
      linkText: string;
      sectionYear: number | null;
    }
  | {
      status: 'recognized';
      kind: 'contest';
      seasonYear: number;
      seriesId: 'gpm' | 'mexico-finals';
      stage: 'fecha-0' | 'qualifier-1' | 'qualifier-2' | 'qualifier-3' | 'repechage' | 'final';
      sourceEditionLabel: string;
      publicationState: 'final' | 'provisional' | 'live' | 'unknown';
      url: string;
      linkText: string;
      sectionYear: number | null;
    }
  | {
      status: 'excluded';
      reason: 'latam-championship' | 'training-camp';
      url: string;
      linkText: string;
      sectionYear: number | null;
    }
  | {
      status: 'staged';
      reason: 'unknown-icpc-mexico-event' | 'section-year-mismatch' | 'outside-contests-origin';
      url: string;
      linkText: string;
      sectionYear: number | null;
    };

export interface ICPCMexicoIndexResult {
  indexUrl: string;
  seasons: number[];
  discoveries: ICPCMexicoDiscovery[];
  duplicateUrls: string[];
}

export interface ICPCMexicoSeasonResult {
  seasonYear: number;
  accumulatedUrl: string | null;
  stagedLinks: { url: string; linkText: string; reason: string }[];
}

export interface ICPCMexicoScoreboardContext {
  seasonYear: number;
  seriesId: 'gpm' | 'mexico-finals';
  stage: 'fecha-0' | 'qualifier-1' | 'qualifier-2' | 'qualifier-3' | 'repechage' | 'final';
  sourceEditionLabel: string;
  publicationState: 'final' | 'provisional' | 'live' | 'unknown';
}

export interface ICPCMexicoScoreboardPayload {
  sourceEditionLabel: string;
  contest: {
    seasonYear: number;
    seriesId: 'gpm' | 'mexico-finals';
    stage: ICPCMexicoScoreboardContext['stage'];
    name: string;
    publicationState: ICPCMexicoScoreboardContext['publicationState'];
    date: string | null;
    durationMinutes: number | null;
    penaltyMinutesPerFailedAttempt: number | null;
    problemLabels: string[];
  };
  rows: {
    place: number;
    sourceTeamId: null;
    teamName: string;
    sourceSchoolId: null;
    schoolName: string | null;
    results:
      | {
          status: 'unattempted' | 'attempted' | 'solved';
          attempts?: number;
          solvedAtMinute?: number;
        }[]
      | null;
    publishedTotals: { solved: number; penalty: number | null };
    evidence: {
      field: string;
      kind: 'html-cell';
      locator: string;
      page: null;
      excerpt: string;
      confidence: 1;
    }[];
  }[];
  coverage: {
    expectedRowCount: number | null;
    rowsComplete: boolean;
    paginationComplete: boolean | null;
  };
  warnings: string[];
}

type ICPCMexicoProblemResult = NonNullable<
  ICPCMexicoScoreboardPayload['rows'][number]['results']
>[number];

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

const childNodes = (node: HtmlNode): readonly HtmlNode[] =>
  'childNodes' in node ? node.childNodes : [];

const isElement = (node: HtmlNode): node is HtmlElement => 'tagName' in node;

const attribute = (element: HtmlElement, name: string): string | undefined =>
  element.attrs.find((item) => item.name === name)?.value;

const textContent = (node: HtmlNode): string => {
  if (node.nodeName === '#text' && 'value' in node) {
    return node.value;
  }
  return childNodes(node).map(textContent).join(' ').replace(/\s+/g, ' ').trim();
};

const flattenDocument = (root: HtmlNode): HtmlNode[] => {
  const nodes: HtmlNode[] = [];
  const visit = (node: HtmlNode): void => {
    nodes.push(node);
    childNodes(node).forEach(visit);
  };
  visit(root);
  return nodes;
};

const elements = (root: HtmlNode, tagName: string): HtmlElement[] =>
  flattenDocument(root).filter(
    (node): node is HtmlElement => isElement(node) && node.tagName === tagName,
  );

const elementChildren = (element: HtmlElement, tagName: string): HtmlElement[] =>
  element.childNodes.filter(
    (node): node is HtmlElement => isElement(node) && node.tagName === tagName,
  );

const parseNonnegativeInteger = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const parseProblemCell = (value: string): ICPCMexicoProblemResult | null => {
  const cell = value.trim();
  if (cell === '·') {
    return { status: 'unattempted' };
  }
  const failed = /^\((\d+)\)$/.exec(cell);
  if (failed !== null) {
    const attempts = parseNonnegativeInteger(failed[1]);
    return attempts === undefined || attempts === 0 ? null : { status: 'attempted', attempts };
  }
  const solved = /^(\d+)(?:\s*\+(\d+))?$/.exec(cell);
  if (solved !== null) {
    const solvedAtMinute = parseNonnegativeInteger(solved[1]);
    const failedAttempts = parseNonnegativeInteger(solved.at(2) ?? '0');
    return solvedAtMinute === undefined || failedAttempts === undefined
      ? null
      : {
          status: 'solved',
          attempts: failedAttempts + 1,
          solvedAtMinute,
        };
  }
  return null;
};

const monthNumbers: Record<string, string | undefined> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

const parseSpanishDate = (text: string): string | null => {
  const match = /(?:inici[oó]\s+)?(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})/iu.exec(text);
  if (match === null) {
    return null;
  }
  const month = monthNumbers[match[2].toLocaleLowerCase('es')];
  if (month === undefined) {
    return null;
  }
  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
};

const makeCellEvidence = (
  rowIndex: number,
  field: string,
  columnIndex: number,
  excerpt: string,
) => ({
  field: `rows[${String(rowIndex)}].${field}`,
  kind: 'html-cell' as const,
  locator: `table tbody tr:nth-child(${String(rowIndex + 1)}) td:nth-child(${String(columnIndex + 1)})`,
  page: null,
  excerpt,
  confidence: 1 as const,
});

export const parseICPCMexicoScoreboard = (
  html: string,
  context: ICPCMexicoScoreboardContext,
): ICPCMexicoScoreboardPayload => {
  const document = parse(html);
  const tables = elements(document, 'table');
  const table = tables.find((candidate) => {
    const firstRow = elements(candidate, 'tr').at(0);
    if (firstRow === undefined) {
      return false;
    }
    const labels = elementChildren(firstRow, 'th').map((cell) => textContent(cell));
    return (
      labels.length >= 5 &&
      labels[0] === '#' &&
      labels[1] === 'Equipo' &&
      labels[2] === '✓' &&
      labels[3] === 'Pen'
    );
  });
  if (table === undefined) {
    throw new Error(
      'ICPC Mexico scoreboard table with Place/Team/Solved/Penalty headers was not found.',
    );
  }
  const headerRow = elements(table, 'tr').at(0);
  if (headerRow === undefined) {
    throw new Error('ICPC Mexico scoreboard table has no header row.');
  }
  const headers = elementChildren(headerRow, 'th');
  const problemHeaders = headers.slice(4);
  const problemLabels = problemHeaders.map((header) => textContent(header));
  if (problemLabels.length === 0 || problemLabels.some((label) => !/^[A-Z][0-9]?$/.test(label))) {
    throw new Error('ICPC Mexico scoreboard has missing or unrecognized problem labels.');
  }
  const penaltyRuleTitle = attribute(headers[3], 'title') ?? '';
  const penaltyMatch = /(\d+)\s*m\s+por\s+intento incorrecto/i.exec(penaltyRuleTitle);
  const penaltyMinutesPerFailedAttempt =
    penaltyMatch === null ? null : (parseNonnegativeInteger(penaltyMatch[1]) ?? null);
  const rows = elements(table, 'tbody').flatMap((body) => elementChildren(body, 'tr'));
  if (rows.length === 0) {
    throw new Error('ICPC Mexico scoreboard contained no team rows.');
  }
  const pageText = textContent(document);
  const expectedMatch = /(\d+)\s+equipos registrados/i.exec(pageText);
  const expectedRowCount =
    expectedMatch === null ? null : (parseNonnegativeInteger(expectedMatch[1]) ?? null);
  const contestName =
    elements(document, 'header')
      .flatMap((header) => elementChildren(header, 'p'))
      .map(textContent)
      .find((text) => text.length > 0 && !/equipos registrados/i.test(text)) ?? null;
  if (contestName === null) {
    throw new Error('ICPC Mexico scoreboard contest name is not present in the page header.');
  }
  const date = parseSpanishDate(pageText);
  const warnings: string[] = [];
  if (penaltyMinutesPerFailedAttempt === null) {
    warnings.push('Penalty rule was not recognized from the scoreboard heading.');
  }
  if (expectedRowCount === null) {
    warnings.push('Expected registered-team count is not present; row completeness is unknown.');
  } else if (expectedRowCount !== rows.length) {
    warnings.push(
      `Registered-team count ${String(expectedRowCount)} does not match ${String(rows.length)} table rows.`,
    );
  }
  if (date === null) {
    warnings.push('Contest date was not recognized from the scoreboard header.');
  }

  const standings = rows.map((row, rowIndex) => {
    const cells = elementChildren(row, 'td');
    if (cells.length !== headers.length) {
      throw new Error(
        `Scoreboard row ${String(rowIndex + 1)} has ${String(cells.length)} cells; expected ${String(headers.length)}.`,
      );
    }
    const placeText = textContent(cells[0]);
    const solvedText = textContent(cells[2]);
    const penaltyText = textContent(cells[3]);
    const place = parseNonnegativeInteger(placeText);
    const solved = parseNonnegativeInteger(solvedText);
    const penalty = parseNonnegativeInteger(penaltyText);
    if (place === undefined || place === 0 || solved === undefined || penalty === undefined) {
      throw new Error(
        `Scoreboard row ${String(rowIndex + 1)} has invalid place or published totals.`,
      );
    }
    const teamCellParagraphs = elements(cells[1], 'p');
    const teamNameCell = teamCellParagraphs.at(0);
    const schoolNameCell = teamCellParagraphs.at(1);
    const teamName = teamNameCell === undefined ? '' : textContent(teamNameCell);
    const schoolName = schoolNameCell === undefined ? null : textContent(schoolNameCell);
    if (teamName.length === 0) {
      throw new Error(`Scoreboard row ${String(rowIndex + 1)} has no team name.`);
    }
    const parsedResults = cells.slice(4).map((cell) => parseProblemCell(textContent(cell)));
    const resultsAreComplete = parsedResults.every((result) => result !== null);
    if (!resultsAreComplete) {
      warnings.push(
        `Problem detail for scoreboard row ${String(rowIndex + 1)} is incomplete; published totals were retained.`,
      );
    }
    const evidence = [
      makeCellEvidence(rowIndex, 'place', 0, placeText),
      makeCellEvidence(rowIndex, 'teamName', 1, teamName),
      makeCellEvidence(rowIndex, 'publishedTotals.solved', 2, solvedText),
      makeCellEvidence(rowIndex, 'publishedTotals.penalty', 3, penaltyText),
      ...cells
        .slice(4)
        .map((cell, problemIndex) =>
          makeCellEvidence(
            rowIndex,
            `results.${problemLabels[problemIndex]}`,
            problemIndex + 4,
            textContent(cell),
          ),
        ),
    ];
    return {
      place,
      sourceTeamId: null,
      teamName,
      sourceSchoolId: null,
      schoolName,
      results: resultsAreComplete ? parsedResults : null,
      publishedTotals: { solved, penalty },
      evidence,
    };
  });
  const rowsComplete = expectedRowCount !== null && expectedRowCount === rows.length;
  if (!rowsComplete) {
    warnings.push('Standings row completeness could not be confirmed.');
  }
  return {
    sourceEditionLabel: context.sourceEditionLabel,
    contest: {
      seasonYear: context.seasonYear,
      seriesId: context.seriesId,
      stage: context.stage,
      name: contestName,
      publicationState: context.publicationState,
      date,
      durationMinutes: null,
      penaltyMinutesPerFailedAttempt,
      problemLabels,
    },
    rows: standings,
    coverage: {
      expectedRowCount,
      rowsComplete,
      paginationComplete: rowsComplete ? true : null,
    },
    warnings: [...new Set(warnings)],
  };
};

const yearFromPath = (path: string): number | undefined => {
  const match = /^\/contests\/(?:gpmx-|regional-mexico-)(\d{4})(?:\/|$|-)/.exec(path);
  return match === null ? undefined : Number(match[1]);
};

const publicationStateFromLink = (
  linkText: string,
): 'final' | 'provisional' | 'live' | 'unknown' => {
  if (/\bfinalizado\b/i.test(linkText)) {
    return 'final';
  }
  if (/\bprovisional\b/i.test(linkText)) {
    return 'provisional';
  }
  if (/\ben curso\b|\blive\b/i.test(linkText)) {
    return 'live';
  }
  return 'unknown';
};

const isPotentialGpmOrFinalLink = (href: string): boolean => {
  try {
    const url = new URL(href, INDEX_URL);
    return /^\/contests\/(?:gpmx|regional-mexico|campeonato-latam|tcmx)-\d{4}(?:-|\/|$)/.test(
      url.pathname,
    );
  } catch {
    return false;
  }
};

const classifyLink = (
  rawHref: string,
  linkText: string,
  sectionYear: number | null,
): ICPCMexicoDiscovery => {
  let url: URL;
  try {
    url = new URL(rawHref, INDEX_URL);
  } catch {
    return {
      status: 'staged',
      reason: 'unknown-icpc-mexico-event',
      url: rawHref,
      linkText,
      sectionYear,
    };
  }
  const normalizedUrl = new URL(url.href);
  normalizedUrl.hash = '';
  if (normalizedUrl.origin !== CONTESTS_ORIGIN || normalizedUrl.protocol !== 'https:') {
    return {
      status: 'staged',
      reason: 'outside-contests-origin',
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  const path = normalizedUrl.pathname.replace(/\/$/, '');
  const year = yearFromPath(path);
  if (/^\/contests\/campeonato-latam-\d{4}$/.test(path)) {
    return {
      status: 'excluded',
      reason: 'latam-championship',
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  if (/^\/contests\/tcmx-\d{4}$/.test(path)) {
    return {
      status: 'excluded',
      reason: 'training-camp',
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  if (year === undefined) {
    return {
      status: 'staged',
      reason: 'unknown-icpc-mexico-event',
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  if (sectionYear !== null && sectionYear !== year) {
    return {
      status: 'staged',
      reason: 'section-year-mismatch',
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }

  const seasonPage = /^\/contests\/gpmx-(\d{4})$/.exec(path);
  if (seasonPage !== null) {
    return {
      status: 'recognized',
      kind: 'gpm-season',
      seasonYear: year,
      sourceEditionLabel: String(year),
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  const qualifier = /^\/contests\/gpmx-(\d{4})-fecha-([0-3])$/.exec(path);
  if (qualifier !== null) {
    const fecha = Number(qualifier[2]);
    return {
      status: 'recognized',
      kind: 'contest',
      seasonYear: year,
      seriesId: 'gpm',
      stage:
        fecha === 0
          ? 'fecha-0'
          : (`qualifier-${String(fecha)}` as 'qualifier-1' | 'qualifier-2' | 'qualifier-3'),
      sourceEditionLabel: String(year),
      publicationState: publicationStateFromLink(linkText),
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  if (new RegExp(`^/contests/gpmx-${String(year)}-repechaje$`).test(path)) {
    return {
      status: 'recognized',
      kind: 'contest',
      seasonYear: year,
      seriesId: 'gpm',
      stage: 'repechage',
      sourceEditionLabel: String(year),
      publicationState: publicationStateFromLink(linkText),
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  if (path === `/contests/regional-mexico-${String(year)}`) {
    return {
      status: 'recognized',
      kind: 'contest',
      seasonYear: year,
      seriesId: 'mexico-finals',
      stage: 'final',
      sourceEditionLabel: String(year),
      publicationState: publicationStateFromLink(linkText),
      url: normalizedUrl.href,
      linkText,
      sectionYear,
    };
  }
  return {
    status: 'staged',
    reason: 'unknown-icpc-mexico-event',
    url: normalizedUrl.href,
    linkText,
    sectionYear,
  };
};

export const discoverICPCMexicoIndex = (html: string): ICPCMexicoIndexResult => {
  const document = parse(html);
  const nodes = flattenDocument(document);
  const headings = nodes.flatMap((node, index) => {
    if (!isElement(node) || !/^h[1-6]$/.test(node.tagName)) {
      return [];
    }
    const match = /^temporada\s+(\d{4})$/i.exec(textContent(node));
    return match === null ? [] : [{ index, seasonYear: Number(match[1]) }];
  });
  const seasons = [...new Set(headings.map(({ seasonYear }) => seasonYear))].sort((a, b) => b - a);
  const discoveries: ICPCMexicoDiscovery[] = [];
  const seen = new Set<string>();
  const duplicateUrls: string[] = [];

  nodes.forEach((node, index) => {
    if (!isElement(node) || node.tagName !== 'a') {
      return;
    }
    const href = attribute(node, 'href');
    if (href === undefined || href.startsWith('#') || !isPotentialGpmOrFinalLink(href)) {
      return;
    }
    let sectionYear: number | null = null;
    for (const heading of headings) {
      if (heading.index >= index) {
        break;
      }
      sectionYear = heading.seasonYear;
    }
    const discovery = classifyLink(href, textContent(node), sectionYear);
    if ('url' in discovery && seen.has(discovery.url)) {
      duplicateUrls.push(discovery.url);
      return;
    }
    if ('url' in discovery) {
      seen.add(discovery.url);
    }
    discoveries.push(discovery);
  });

  return { indexUrl: INDEX_URL, seasons, discoveries, duplicateUrls };
};

export const discoverICPCMexicoSeason = (
  html: string,
  seasonYear: number,
): ICPCMexicoSeasonResult => {
  const document = parse(html);
  const links: { url: string; linkText: string }[] = [];
  flattenDocument(document).forEach((node) => {
    if (!isElement(node) || node.tagName !== 'a') {
      return;
    }
    const href = attribute(node, 'href');
    if (href === undefined) {
      return;
    }
    let url: URL;
    try {
      url = new URL(href, INDEX_URL);
    } catch {
      return;
    }
    if (url.origin === CONTESTS_ORIGIN && url.protocol === 'https:') {
      links.push({ url: url.href, linkText: textContent(node) });
    }
  });
  const accumulated = links.filter(({ url }) => {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname === `/contests/gpmx-${String(seasonYear)}/acumulado`;
  });
  return {
    seasonYear,
    accumulatedUrl: accumulated.length === 1 ? accumulated[0].url : null,
    stagedLinks:
      accumulated.length > 1
        ? accumulated.map((link) => ({ ...link, reason: 'duplicate accumulated standing links' }))
        : [],
  };
};
