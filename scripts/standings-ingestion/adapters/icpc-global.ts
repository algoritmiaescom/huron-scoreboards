import { parse } from 'parse5';

import type { DefaultTreeAdapterTypes } from 'parse5';

const ICPC_GLOBAL_ORIGIN = 'https://icpc.global';
const ICPC_MEXICO_ORIGIN = 'https://www.icpcmexico.org';
const SCORELATAM_ORIGIN = 'https://scorelatam.naquadah.com.br';
const ITESO_ORIGINS = ['https://eventos.iteso.mx', 'https://acm.iteso.mx'];

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

export interface ICPCGlobalDiscoveredContest {
  kind: 'gpm' | 'mexico-finals';
  editionYear: number;
  sourceEditionLabel: string;
  name: string;
  contestUrl: string;
  standingsUrl: string | null;
}

export interface ICPCGlobalStagedLink {
  url: string;
  linkText: string;
  reason: string;
}

export interface ICPCGlobalDirectoryDiscovery {
  cycleLabel: string;
  editionYear: number;
  contests: ICPCGlobalDiscoveredContest[];
  excludedContestLabels: string[];
  stagedLinks: ICPCGlobalStagedLink[];
}

export interface ICPCGlobalFinderDiscovery {
  finderUrl: string;
  title: string | null;
  eventKind: 'gpm' | 'mexico-finals' | 'unknown';
  editionYear: number | null;
  sourceEditionLabel: string | null;
  standingsUrl: string | null;
  gpmContestUrl: string | null;
  priorYearUrl: string | null;
  publicationState: 'final' | 'unknown';
  stagedLinks: ICPCGlobalStagedLink[];
}

export interface ICPCGlobalStandingsRow {
  place: number;
  institution: string;
  team: string;
  solved: number;
  totalTime: number;
  lastSolution: string | null;
  locator: string;
}

export type ICPCGlobalStandingsExtraction =
  | {
      status: 'ready';
      title: string;
      rows: ICPCGlobalStandingsRow[];
      expectedRowCount: number;
      rowsComplete: true;
      warnings: string[];
    }
  | {
      status: 'staged';
      title: string | null;
      rows: ICPCGlobalStandingsRow[];
      expectedRowCount: number | null;
      rowsComplete: false;
      warnings: string[];
      reason: string;
    };

export type ICPCGlobalDocumentType = 'pdf' | 'image' | 'html' | 'unknown';

interface TableColumns {
  place: number;
  institution: number;
  team: number;
  solved: number;
  totalTime: number;
  lastSolution: number | null;
}

const childNodes = (node: HtmlNode): readonly HtmlNode[] =>
  'childNodes' in node ? node.childNodes : [];

const isElement = (node: HtmlNode): node is HtmlElement => 'tagName' in node;

const attribute = (element: HtmlElement, name: string): string | undefined =>
  element.attrs.find((item) => item.name === name)?.value;

const flattenDocument = (root: HtmlNode): HtmlNode[] => {
  const nodes: HtmlNode[] = [];
  const visit = (node: HtmlNode): void => {
    nodes.push(node);
    childNodes(node).forEach(visit);
  };
  visit(root);
  return nodes;
};

const normalizedText = (node: HtmlNode): string => {
  if (node.nodeName === '#text' && 'value' in node) {
    return node.value.replace(/\s+/g, ' ').trim();
  }
  return childNodes(node)
    .map(normalizedText)
    .filter((text) => text.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizedHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();

const safeURL = (href: string, base: string): URL | undefined => {
  try {
    const url = new URL(href, base);
    url.hash = '';
    if (
      url.protocol !== 'https:' ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      ![ICPC_GLOBAL_ORIGIN, ICPC_MEXICO_ORIGIN, SCORELATAM_ORIGIN, ...ITESO_ORIGINS].includes(
        url.origin,
      )
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
};

const editionYearFromLabel = (label: string): number | undefined => {
  const match = /\b(?:The\s+)?((?:19|20)\d{2})\s+ICPC\b/i.exec(label);
  return match === null ? undefined : Number(match[1]);
};

const cycleYear = (cycleLabel: string): number | undefined => {
  const match = /^((?:19|20)\d{2})-((?:19|20)\d{2})$/.exec(cycleLabel.trim());
  if (match === null || Number(match[2]) !== Number(match[1]) + 1) {
    return undefined;
  }
  return Number(match[1]);
};

const tableRows = (table: HtmlElement): HtmlElement[][] =>
  flattenDocument(table)
    .filter((node): node is HtmlElement => isElement(node) && node.tagName === 'tr')
    .map((row) =>
      childNodes(row).filter(
        (cell): cell is HtmlElement =>
          isElement(cell) && (cell.tagName === 'th' || cell.tagName === 'td'),
      ),
    );

const findColumn = (headers: readonly string[], match: RegExp): number =>
  headers.findIndex((header) => match.test(normalizedHeader(header)));

const standingsColumns = (headers: readonly string[]): TableColumns | undefined => {
  const columns = {
    place: findColumn(headers, /^(?:place|rank|position)$/),
    institution: findColumn(headers, /^(?:institution|school|university)$/),
    team: findColumn(headers, /^team$/),
    solved: findColumn(headers, /^(?:problems solved|solved)$/),
    totalTime: findColumn(headers, /^(?:total time|penalty)$/),
    lastSolution: findColumn(headers, /^(?:last solution|last solve)$/),
  };
  if (
    columns.place < 0 ||
    columns.institution < 0 ||
    columns.team < 0 ||
    columns.solved < 0 ||
    columns.totalTime < 0
  ) {
    return undefined;
  }
  return {
    ...columns,
    lastSolution: columns.lastSolution < 0 ? null : columns.lastSolution,
  };
};

const numericCell = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return undefined;
  }
  const number = Number(normalized);
  return Number.isSafeInteger(number) ? number : undefined;
};

const isValidRanking = (places: readonly number[]): boolean => {
  const sorted = [...places].sort((left, right) => left - right);
  let expected = 1;
  let index = 0;
  while (index < sorted.length) {
    if (sorted[index] !== expected) {
      return false;
    }
    let tieCount = 0;
    while (index < sorted.length && sorted[index] === expected) {
      tieCount += 1;
      index += 1;
    }
    expected += tieCount;
  }
  return true;
};

export const classifyICPCGlobalDocument = (
  contentType: string | null,
  body: Uint8Array,
): ICPCGlobalDocumentType => {
  const declared = contentType?.split(';')[0].trim().toLowerCase() ?? '';
  const prefix = new TextDecoder().decode(body.subarray(0, 512)).trimStart().toLowerCase();
  if (prefix.startsWith('%pdf-')) {
    return 'pdf';
  }
  if (prefix.startsWith('<!doctype html') || prefix.startsWith('<html')) {
    return 'html';
  }
  if (
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47 &&
    body[4] === 0x0d &&
    body[5] === 0x0a &&
    body[6] === 0x1a &&
    body[7] === 0x0a
  ) {
    return 'image';
  }
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return 'image';
  }
  if (prefix.startsWith('gif8')) {
    return 'image';
  }
  if (
    body[0] === 0x52 &&
    body[1] === 0x49 &&
    body[2] === 0x46 &&
    body[3] === 0x46 &&
    new TextDecoder().decode(body.subarray(8, 12)) === 'WEBP'
  ) {
    return 'image';
  }
  if (declared === 'application/pdf') {
    return 'pdf';
  }
  if (declared === 'text/html' || declared === 'application/xhtml+xml') {
    return 'html';
  }
  if (declared.startsWith('image/')) {
    return 'image';
  }
  return 'unknown';
};

export const deduplicateICPCGlobalDestinations = (
  destinations: readonly (string | null)[],
): string[] => [
  ...new Set(destinations.filter((destination): destination is string => destination !== null)),
];

export const discoverICPCGlobalDirectory = (
  html: string,
  cycleLabel: string,
  directoryUrl = `${ICPC_GLOBAL_ORIGIN}/regionals/contests`,
): ICPCGlobalDirectoryDiscovery => {
  const document = parse(html);
  const expectedYear = cycleYear(cycleLabel);
  const stagedLinks: ICPCGlobalStagedLink[] = [];
  const excludedContestLabels: string[] = [];
  const contests: ICPCGlobalDiscoveredContest[] = [];
  if (expectedYear === undefined) {
    return {
      cycleLabel,
      editionYear: 0,
      contests,
      excludedContestLabels,
      stagedLinks: [
        {
          url: directoryUrl,
          linkText: cycleLabel,
          reason: 'cycle label is not a consecutive two-year ICPC cycle',
        },
      ],
    };
  }
  const tables = flattenDocument(document).filter(
    (node): node is HtmlElement => isElement(node) && node.tagName === 'table',
  );
  const table = tables.find((candidate) =>
    tableRows(candidate).some((row) => {
      const headers = row.map(normalizedText);
      return findColumn(headers, /^contest$/) >= 0 && findColumn(headers, /^standings$/) >= 0;
    }),
  );
  if (table === undefined) {
    return {
      cycleLabel,
      editionYear: expectedYear,
      contests,
      excludedContestLabels,
      stagedLinks: [
        {
          url: directoryUrl,
          linkText: cycleLabel,
          reason: 'Latin America contest table or Standings column was not found',
        },
      ],
    };
  }
  const rows = tableRows(table);
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizedText);
    return findColumn(headers, /^contest$/) >= 0 && findColumn(headers, /^standings$/) >= 0;
  });
  const headers = rows[headerIndex].map(normalizedText);
  const contestIndex = findColumn(headers, /^contest$/);
  const standingsIndex = findColumn(headers, /^standings$/);
  const seenContestUrls = new Set<string>();
  for (const [rowIndex, row] of rows.entries()) {
    if (rowIndex <= headerIndex || row.length <= Math.max(contestIndex, standingsIndex)) {
      continue;
    }
    const contestCell = row[contestIndex];
    const anchors = flattenDocument(contestCell).filter(
      (node): node is HtmlElement => isElement(node) && node.tagName === 'a',
    );
    const contestAnchor = anchors.at(0);
    if (contestAnchor === undefined) {
      continue;
    }
    const name = normalizedText(contestAnchor);
    if (/\b(?:masters|women|training camp|training camps|camp mexico)\b/i.test(name)) {
      excludedContestLabels.push(name);
      continue;
    }
    const kind: ICPCGlobalDiscoveredContest['kind'] | undefined = /\bGran Premio de Mexico\b/i.test(
      name,
    )
      ? 'gpm'
      : /\bMexico Finals\b/i.test(name)
        ? 'mexico-finals'
        : undefined;
    if (kind === undefined) {
      continue;
    }
    const editionYear = editionYearFromLabel(name);
    const contestHref = attribute(contestAnchor, 'href');
    const contestUrl = contestHref === undefined ? undefined : safeURL(contestHref, directoryUrl);
    const suffixYear =
      contestUrl === undefined ? undefined : Number(/-(\d{4})$/.exec(contestUrl.pathname)?.[1]);
    if (
      editionYear === undefined ||
      editionYear !== expectedYear ||
      contestUrl === undefined ||
      suffixYear !== editionYear + 1
    ) {
      stagedLinks.push({
        url: contestUrl?.href ?? directoryUrl,
        linkText: name,
        reason:
          'contest display year, selected cycle, and URL identifier do not agree under the reviewed +1 identifier rule',
      });
      continue;
    }
    if (seenContestUrls.has(contestUrl.href)) {
      stagedLinks.push({
        url: contestUrl.href,
        linkText: name,
        reason: 'directory repeats a recognized Mexican contest destination',
      });
      continue;
    }
    seenContestUrls.add(contestUrl.href);
    const standingsCell = row[standingsIndex];
    const standingsAnchors = flattenDocument(standingsCell).filter(
      (node): node is HtmlElement => isElement(node) && node.tagName === 'a',
    );
    let standingsUrl: string | null = null;
    if (standingsAnchors.length > 1) {
      stagedLinks.push({
        url: contestUrl.href,
        linkText: name,
        reason: 'multiple Standings-column destinations require review',
      });
    } else if (standingsAnchors.length === 1) {
      const href = attribute(standingsAnchors[0], 'href');
      const destination = href === undefined ? undefined : safeURL(href, directoryUrl);
      if (destination === undefined) {
        stagedLinks.push({
          url: href ?? contestUrl.href,
          linkText: name,
          reason: 'Standings-column destination is outside the approved HTTPS origins',
        });
      } else {
        standingsUrl = destination.href;
      }
    }
    contests.push({
      kind,
      editionYear,
      sourceEditionLabel: String(editionYear),
      name,
      contestUrl: contestUrl.href,
      standingsUrl,
    });
  }
  return { cycleLabel, editionYear: expectedYear, contests, excludedContestLabels, stagedLinks };
};

export const discoverICPCGlobalFinder = (
  html: string,
  finderUrl: string,
): ICPCGlobalFinderDiscovery => {
  const document = parse(html);
  const stagedLinks: ICPCGlobalStagedLink[] = [];
  const nodes = flattenDocument(document);
  const titleNode = nodes.find(
    (node) =>
      isElement(node) &&
      /^h[1-6]$/.test(node.tagName) &&
      /\bICPC (?:Mexico Finals|Gran Premio de Mexico)\b/i.test(normalizedText(node)),
  );
  const title = titleNode === undefined ? null : normalizedText(titleNode);
  const editionYear = title === null ? undefined : editionYearFromLabel(title);
  const eventKind: ICPCGlobalFinderDiscovery['eventKind'] =
    title !== null && /\bGran Premio de Mexico\b/i.test(title)
      ? 'gpm'
      : title !== null && /\bMexico Finals\b/i.test(title)
        ? 'mexico-finals'
        : 'unknown';
  let finderPath: URL;
  try {
    finderPath = new URL(finderUrl);
  } catch {
    finderPath = new URL(`${ICPC_GLOBAL_ORIGIN}/regionals/finder/mexico`);
  }
  const anchors = nodes.filter(
    (node): node is HtmlElement => isElement(node) && node.tagName === 'a',
  );
  const resolveLink = (
    predicate: (text: string, url: URL | undefined) => boolean,
    label: string,
    required = true,
  ): string | null => {
    const found = anchors.flatMap((anchor) => {
      const text = normalizedText(anchor);
      const href = attribute(anchor, 'href');
      const url = href === undefined ? undefined : safeURL(href, finderPath.href);
      return predicate(text, url) ? [{ anchor, text, url }] : [];
    });
    if (found.length > 1) {
      stagedLinks.push({
        url: finderPath.href,
        linkText: label,
        reason: `finder page has multiple ${label} links`,
      });
      return null;
    }
    const link = found.at(0);
    if (link === undefined) {
      if (required) {
        stagedLinks.push({
          url: finderPath.href,
          linkText: label,
          reason: `finder page is missing its ${label} link`,
        });
      }
      return null;
    }
    if (link.url === undefined) {
      stagedLinks.push({
        url: attribute(link.anchor, 'href') ?? finderPath.href,
        linkText: link.text,
        reason: `${label} destination is outside the approved HTTPS origins`,
      });
      return null;
    }
    return link.url.href;
  };
  if (title === null || editionYear === undefined) {
    stagedLinks.push({
      url: finderPath.href,
      linkText: '',
      reason: 'finder page does not display a recognized ICPC Mexico event edition title',
    });
  }
  const standingsUrl = resolveLink((text) => /^see standings$/i.test(text), 'See Standings');
  const priorYearUrl = resolveLink(
    (text) => /^see prior year$/i.test(text),
    'See Prior Year',
    false,
  );
  const gpmContestUrl = resolveLink(
    (text, url) =>
      url !== undefined &&
      /\/mcapgp-\d{4}\/?$/i.test(url.pathname) &&
      /\bGran Premio de Mexico\b/i.test(text) &&
      editionYearFromLabel(text) === editionYear,
    'GPM Contest List',
    eventKind === 'mexico-finals',
  );
  const pageSuffix = Number(/-(\d{4})$/.exec(finderPath.pathname)?.[1]);
  if (editionYear !== undefined && pageSuffix > 0 && pageSuffix !== editionYear + 1) {
    stagedLinks.push({
      url: finderPath.href,
      linkText: title ?? '',
      reason:
        'finder URL identifier does not match the displayed Mexican edition under the reviewed +1 rule',
    });
  }
  if (priorYearUrl !== null && editionYear !== undefined) {
    const priorSuffix = Number(/-(\d{4})$/.exec(new URL(priorYearUrl).pathname)?.[1]);
    if (priorSuffix > 0 && priorSuffix !== editionYear) {
      stagedLinks.push({
        url: priorYearUrl,
        linkText: 'See Prior Year',
        reason: 'prior-year URL does not identify the immediately preceding edition',
      });
    }
  }
  const bodyText = normalizedText(document);
  return {
    finderUrl: finderPath.href,
    title,
    eventKind,
    editionYear: editionYear ?? null,
    sourceEditionLabel: editionYear === undefined ? null : String(editionYear),
    standingsUrl,
    gpmContestUrl,
    priorYearUrl,
    publicationState: /\bPast Contest\b/i.test(bodyText) ? 'final' : 'unknown',
    stagedLinks,
  };
};

export type ICPCGlobalStandingsLinkDiscovery =
  | { status: 'found'; url: string; linkText: string }
  | {
      status: 'missing' | 'staged';
      candidates: ICPCGlobalStagedLink[];
    };

export const discoverICPCGlobalStandingsLink = (
  html: string,
  landingUrl: string,
): ICPCGlobalStandingsLinkDiscovery => {
  const document = parse(html);
  const links = flattenDocument(document).flatMap((node) => {
    if (!isElement(node) || node.tagName !== 'a') {
      return [];
    }
    const href = attribute(node, 'href');
    if (href === undefined) {
      return [];
    }
    const linkText = normalizedText(node);
    const url = safeURL(href, landingUrl);
    const looksLikeStandings =
      /\b(?:standings?|scoreboard|results?)\b/i.test(linkText) ||
      /\.(?:pdf|png|jpe?g|gif|webp)$/i.test(href.split(/[?#]/)[0] ?? '');
    return looksLikeStandings ? [{ href, linkText, url }] : [];
  });
  const unique = [...new Map(links.map((link) => [link.href, link])).values()];
  if (unique.length === 0) {
    return { status: 'missing', candidates: [] };
  }
  if (unique.length > 1) {
    return {
      status: 'staged',
      candidates: unique.map(({ href, linkText }) => ({
        url: href,
        linkText,
        reason: 'landing page has multiple possible standings document links',
      })),
    };
  }
  const link = unique[0];
  if (link.url === undefined) {
    return {
      status: 'staged',
      candidates: [
        {
          url: link.href,
          linkText: link.linkText,
          reason: 'landing-page standings destination is outside approved HTTPS origins',
        },
      ],
    };
  }
  return { status: 'found', url: link.url.href, linkText: link.linkText };
};

export const parseICPCGlobalStandings = (html: string): ICPCGlobalStandingsExtraction => {
  const document = parse(html);
  const nodes = flattenDocument(document);
  const titleNode = nodes.find((node) => {
    if (!isElement(node)) {
      return false;
    }
    const text = normalizedText(node);
    return text.length < 100 && /^Standings for\b/i.test(text);
  });
  const title = titleNode === undefined ? null : normalizedText(titleNode);
  const tables = nodes.filter(
    (node): node is HtmlElement => isElement(node) && node.tagName === 'table',
  );
  const selectedTable = tables
    .flatMap((table) => {
      const rows = tableRows(table);
      const headerIndex = rows.findIndex(
        (row) => standingsColumns(row.map(normalizedText)) !== undefined,
      );
      return headerIndex < 0 ? [] : [{ rows, headerIndex }];
    })
    .at(0);
  if (selectedTable === undefined || title === null) {
    return {
      status: 'staged',
      title,
      rows: [],
      expectedRowCount: null,
      rowsComplete: false,
      warnings: [],
      reason: 'recognized Mexico Finals title or totals standings table was not found',
    };
  }
  const headerCells = selectedTable.rows[selectedTable.headerIndex].map(normalizedText);
  const columns = standingsColumns(headerCells);
  if (columns === undefined) {
    return {
      status: 'staged',
      title,
      rows: [],
      expectedRowCount: null,
      rowsComplete: false,
      warnings: [],
      reason: 'standings table columns changed during extraction',
    };
  }
  const warnings: string[] = [];
  const rows: ICPCGlobalStandingsRow[] = [];
  const failures: string[] = [];
  for (const [rowIndex, cells] of selectedTable.rows.entries()) {
    if (
      rowIndex <= selectedTable.headerIndex ||
      cells.some((cell) =>
        flattenDocument(cell).some(
          (node) => isElement(node) && (node.tagName === 'input' || node.tagName === 'select'),
        ),
      )
    ) {
      continue;
    }
    const values = cells.map(normalizedText);
    const place = numericCell(values[columns.place] ?? '');
    const institution = values[columns.institution]?.trim() ?? '';
    const team = values[columns.team]?.trim() ?? '';
    const solved = numericCell(values[columns.solved] ?? '');
    const totalTime = numericCell(values[columns.totalTime] ?? '');
    if (
      place === undefined ||
      institution.length === 0 ||
      team.length === 0 ||
      solved === undefined ||
      totalTime === undefined
    ) {
      failures.push(
        `row ${String(rowIndex - selectedTable.headerIndex)} has an ambiguous place, institution, team, solved, or total time cell`,
      );
      continue;
    }
    rows.push({
      place,
      institution,
      team,
      solved,
      totalTime,
      lastSolution: columns.lastSolution === null ? null : (values[columns.lastSolution] ?? null),
      locator: `table#standings tr:nth-of-type(${String(rowIndex + 1)})`,
    });
  }
  const allText = normalizedText(document);
  const paginationSummaries = [...allText.matchAll(/\b(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)\b/gi)];
  const expectedRowCount =
    paginationSummaries.length === 1 ? Number(paginationSummaries[0][3]) : null;
  if (paginationSummaries.length > 1) {
    failures.push('multiple pagination summaries were found');
  }
  if (rows.length === 0) {
    failures.push('standings table has no parseable result rows');
  }
  if (!isValidRanking(rows.map(({ place }) => place))) {
    failures.push('places do not form standard competition ranking');
  }
  if (expectedRowCount === null) {
    failures.push('pagination summary is missing, so row completeness cannot be verified');
  } else if (rows.length !== expectedRowCount) {
    failures.push(`captured ${String(rows.length)} of ${String(expectedRowCount)} standings rows`);
  }
  if (failures.length > 0 || expectedRowCount === null) {
    return {
      status: 'staged',
      title,
      rows,
      expectedRowCount,
      rowsComplete: false,
      warnings,
      reason: [...new Set(failures)].join('; '),
    };
  }
  warnings.push('Source provides published totals only; no per-problem results were extracted.');
  return {
    status: 'ready',
    title,
    rows,
    expectedRowCount,
    rowsComplete: true,
    warnings,
  };
};
