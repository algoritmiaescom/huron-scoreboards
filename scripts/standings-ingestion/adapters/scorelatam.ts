import { parse } from 'parse5';

import type { DefaultTreeAdapterTypes } from 'parse5';

const SCORELATAM_ORIGIN = 'https://scorelatam.naquadah.com.br';
const INDEX_URL = `${SCORELATAM_ORIGIN}/`;

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

export interface ScoreLATAMEdition {
  editionYear: number;
  playedYear: number | null;
  sourceEditionLabel: string;
  url: string;
}

export interface ScoreLATAMIndexResult {
  indexUrl: string;
  editions: ScoreLATAMEdition[];
  duplicateUrls: string[];
  excludedLinks: { url: string; linkText: string; reason: string }[];
  stagedLinks: { url: string; linkText: string; reason: string }[];
}

export type ScoreLATAMProblemResult =
  | { status: 'unattempted' }
  | { status: 'attempted'; attempts: number }
  | { status: 'solved'; attempts: number; solvedAtMinute: number };

export interface ScoreLATAMMexicoRow {
  mexicoPlace: number;
  latamPlace: number;
  sourceTeamId: string;
  sourceUserSite: string;
  teamName: string;
  schoolName: string | null;
  results: ScoreLATAMProblemResult[] | null;
  publishedTotals: { solved: number; penalty: number };
  evidence: {
    field: string;
    kind: 'html-cell';
    locator: string;
    page: null;
    excerpt: string;
    confidence: 1;
  }[];
}

export interface ScoreLATAMMexicoScoreboard {
  status: 'ready' | 'staged';
  reason: string | null;
  publicationState: 'final' | 'unknown';
  editionYear: number;
  playedYear: number | null;
  sourceEditionLabel: string;
  scoreboardUrl: string;
  mexicoGroupId: number | null;
  eventEquivalence: 'reviewer-approved' | 'unverified';
  problemLabels: string[];
  rows: ScoreLATAMMexicoRow[];
  coverage: {
    rowCount: number;
    rowsComplete: boolean;
    paginationComplete: boolean | null;
  };
  warnings: string[];
}

const childNodes = (node: HtmlNode): readonly HtmlNode[] =>
  'childNodes' in node ? node.childNodes : [];

const isElement = (node: HtmlNode): node is HtmlElement => 'tagName' in node;

const elementChildren = (element: HtmlElement, tagName: string): HtmlElement[] =>
  element.childNodes.filter(
    (node): node is HtmlElement => isElement(node) && node.tagName === tagName,
  );

const attribute = (element: HtmlElement, name: string): string | undefined =>
  element.attrs.find((item) => item.name === name)?.value;

const textContent = (node: HtmlNode): string => {
  if (node.nodeName === '#text' && 'value' in node) {
    return node.value;
  }
  return childNodes(node).map(textContent).join(' ').replace(/\s+/g, ' ').trim();
};

const normalizedText = (node: HtmlNode): string => textContent(node).replace(/\s+/g, ' ').trim();

const flattenDocument = (root: HtmlNode): HtmlNode[] => {
  const nodes: HtmlNode[] = [];
  const visit = (node: HtmlNode): void => {
    nodes.push(node);
    childNodes(node).forEach(visit);
  };
  visit(root);
  return nodes;
};

const isLatamPath = (path: string): boolean => /^\/latam(?:-|\/|$)/i.test(path);

const hasPaginationControls = (nodes: readonly HtmlNode[]): boolean =>
  nodes.some((node) => {
    if (!isElement(node)) {
      return false;
    }
    const className = attribute(node, 'class') ?? '';
    const rel = attribute(node, 'rel')?.split(/\s+/) ?? [];
    const href = attribute(node, 'href') ?? '';
    const accessibleLabel = `${attribute(node, 'aria-label') ?? ''} ${attribute(node, 'title') ?? ''}`;
    if (
      /(?:pagination|paginator|pager|load-more)/i.test(className) ||
      /pagination|paginator|pager/i.test(accessibleLabel) ||
      rel.some((value) => value.toLowerCase() === 'next')
    ) {
      return true;
    }
    if (node.tagName !== 'a' && node.tagName !== 'button') {
      return false;
    }
    return (
      /^(?:next|next page|previous|previous page|siguiente|p[aá]gina siguiente)$/i.test(
        normalizedText(node) || accessibleLabel.trim(),
      ) || /[?&](?:page|p|offset|start)=\d+/i.test(href)
    );
  });

export const discoverScoreLATAMEditions = (html: string): ScoreLATAMIndexResult => {
  const document = parse(html);
  const nodes = flattenDocument(document);
  const headings = nodes.flatMap((node, index) => {
    if (!isElement(node) || !/^h[1-6]$/.test(node.tagName)) {
      return [];
    }
    const section = textContent(node);
    return section.length === 0 ? [] : [{ index, section }];
  });
  const editions: ScoreLATAMEdition[] = [];
  const duplicateUrls: string[] = [];
  const excludedLinks: ScoreLATAMIndexResult['excludedLinks'] = [];
  const stagedLinks: ScoreLATAMIndexResult['stagedLinks'] = [];
  const seenUrls = new Set<string>();

  nodes.forEach((node, index) => {
    if (!isElement(node) || node.tagName !== 'a') {
      return;
    }
    const rawHref = attribute(node, 'href');
    if (rawHref === undefined) {
      return;
    }
    let url: URL;
    try {
      url = new URL(rawHref, INDEX_URL);
    } catch {
      return;
    }
    if (!isLatamPath(url.pathname)) {
      return;
    }
    const linkText = textContent(node);
    url.hash = '';
    if (
      url.origin !== SCORELATAM_ORIGIN ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password
    ) {
      stagedLinks.push({
        url: url.href,
        linkText,
        reason: 'LATAM edition link is outside ScoreLATAM over HTTPS',
      });
      return;
    }

    let section: string | null = null;
    for (const heading of headings) {
      if (heading.index >= index) {
        break;
      }
      section = heading.section;
    }
    if (section !== 'LATAM') {
      excludedLinks.push({
        url: url.href,
        linkText,
        reason: 'edition is outside the LATAM section',
      });
      return;
    }

    const pathMatch = /^\/latam-(\d{4})\/?$/i.exec(url.pathname);
    if (pathMatch === null) {
      stagedLinks.push({ url: url.href, linkText, reason: 'unrecognized LATAM edition URL' });
      return;
    }
    const editionYear = Number(pathMatch[1]);
    const labelYear = /^(\d{4})\b/.exec(linkText);
    if (labelYear !== null && Number(labelYear[1]) !== editionYear) {
      stagedLinks.push({
        url: url.href,
        linkText,
        reason: 'edition label does not match URL year',
      });
      return;
    }
    if (seenUrls.has(url.href)) {
      duplicateUrls.push(url.href);
      return;
    }
    seenUrls.add(url.href);
    const playedYearMatch = /\bin\s+(\d{4})\b/i.exec(linkText);
    editions.push({
      editionYear,
      playedYear: playedYearMatch === null ? null : Number(playedYearMatch[1]),
      sourceEditionLabel: linkText,
      url: url.href,
    });
  });

  return { indexUrl: INDEX_URL, editions, duplicateUrls, excludedLinks, stagedLinks };
};

const nonnegativeInteger = (text: string): number | undefined => {
  if (!/^\d+$/.test(text)) {
    return undefined;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : undefined;
};

const scoreLATAMEvidence = (
  candidateRowIndex: number,
  field: string,
  tableRowIndex: number,
  columnIndex: number,
  excerpt: string,
) => ({
  field: `rows[${String(candidateRowIndex)}].${field}`,
  kind: 'html-cell' as const,
  locator: `#myscoretable tr:nth-child(${String(tableRowIndex + 1)}) td:nth-child(${String(columnIndex + 1)})`,
  page: null,
  excerpt,
  confidence: 1 as const,
});

const parseUserSite = (
  cell: HtmlElement,
): { sourceUserSite: string; sourceTeamId: string } | null => {
  const sourceUserSite = normalizedText(cell).replace(/\s*\/\s*/g, '/');
  const match = /^(.+)\/([A-Z]{2})$/.exec(sourceUserSite);
  if (match === null) {
    return null;
  }
  return { sourceUserSite, sourceTeamId: match[1] };
};

const parseScoreCell = (cell: HtmlElement): ScoreLATAMProblemResult | null => {
  const value = normalizedText(cell).replace(/\s*:\s*/, ':');
  if (value.length === 0) {
    return { status: 'unattempted' };
  }
  const score = /^(?:[^:]+:\s*)?(\d+)\s*\/\s*(\d+|-)$/i.exec(value);
  if (score === null) {
    return null;
  }
  const attempts = nonnegativeInteger(score[1]);
  if (attempts === undefined || attempts === 0) {
    return null;
  }
  if (score[2] === '-') {
    return { status: 'attempted', attempts };
  }
  const solvedAtMinute = nonnegativeInteger(score[2]);
  return solvedAtMinute === undefined ? null : { status: 'solved', attempts, solvedAtMinute };
};

const parsePublishedTotal = (cell: HtmlElement): { solved: number; penalty: number } | null => {
  const match = /^(\d+)\s*\((\d+)\)$/.exec(normalizedText(cell));
  if (match === null) {
    return null;
  }
  const solved = nonnegativeInteger(match[1]);
  const penalty = nonnegativeInteger(match[2]);
  return solved === undefined || penalty === undefined ? null : { solved, penalty };
};

const isStandardCompetitionRanking = (places: readonly number[]): boolean =>
  places.every((place, index) => {
    const expectedPlace = index === 0 ? 1 : place === places[index - 1] ? place : index + 1;
    return place === expectedPlace && place > 0;
  });

const stagedScoreboard = (
  edition: ScoreLATAMEdition,
  reason: string,
  mexicoGroupId: number | null = null,
  problemLabels: string[] = [],
): ScoreLATAMMexicoScoreboard => ({
  status: 'staged',
  reason,
  publicationState: 'unknown',
  editionYear: edition.editionYear,
  playedYear: edition.playedYear,
  sourceEditionLabel: edition.sourceEditionLabel,
  scoreboardUrl: edition.url,
  mexicoGroupId,
  eventEquivalence: 'unverified',
  problemLabels,
  rows: [],
  coverage: { rowCount: 0, rowsComplete: false, paginationComplete: null },
  warnings: [reason],
});

const comparableMexicoRow = (row: ScoreLATAMMexicoRow) => ({
  mexicoPlace: row.mexicoPlace,
  latamPlace: row.latamPlace,
  sourceTeamId: row.sourceTeamId,
  sourceUserSite: row.sourceUserSite,
  teamName: row.teamName,
  schoolName: row.schoolName,
  results: row.results,
  publishedTotals: row.publishedTotals,
});

export const parseScoreLATAMMexicoScoreboard = (
  html: string,
  edition: ScoreLATAMEdition,
): ScoreLATAMMexicoScoreboard => {
  const document = parse(html);
  const nodes = flattenDocument(document);
  if (hasPaginationControls(nodes)) {
    return stagedScoreboard(
      edition,
      'ScoreLATAM page has pagination controls; Mexico-group completeness cannot be confirmed.',
    );
  }
  const scoreGroups = nodes.flatMap((node) => {
    if (!isElement(node) || node.tagName !== 'a') {
      return [];
    }
    const onclick = attribute(node, 'onclick');
    const match = onclick === undefined ? null : /toggleGroup\((\d+)\)/.exec(onclick);
    return match === null ? [] : [{ groupId: Number(match[1]), label: normalizedText(node) }];
  });
  const cclGroupIndex = scoreGroups.findIndex(({ label }) => /^CCL\b/i.test(label));
  const globalGroup = scoreGroups.find(({ label }) => label === 'Global');
  const mexicoGroups =
    cclGroupIndex < 0
      ? []
      : scoreGroups.slice(0, cclGroupIndex).filter(({ label }) => label === 'Mexico');
  if (globalGroup === undefined || mexicoGroups.length !== 1) {
    return stagedScoreboard(
      edition,
      'Could not distinguish the Mexico-only score group from the global/CCL groups.',
    );
  }
  const mexicoGroupId = mexicoGroups[0].groupId;
  const table = nodes.find(
    (node): node is HtmlElement =>
      isElement(node) && node.tagName === 'table' && attribute(node, 'id') === 'myscoretable',
  );
  if (table === undefined) {
    return stagedScoreboard(edition, 'ScoreLATAM score table was not found.', mexicoGroupId);
  }
  const tableRows = flattenDocument(table).filter(
    (node): node is HtmlElement => isElement(node) && node.tagName === 'tr',
  );
  const headerRow = tableRows.at(0);
  if (headerRow === undefined) {
    return stagedScoreboard(edition, 'ScoreLATAM score table has no header row.', mexicoGroupId);
  }
  const headers = elementChildren(headerRow, 'td');
  const headerLabels = headers.map(normalizedText);
  const problemLabels = headerLabels.slice(3, -1);
  if (
    headerLabels[0] !== '#' ||
    headerLabels[1] !== 'User/Site' ||
    headerLabels[2] !== 'Name' ||
    headerLabels.at(-1) !== 'Total' ||
    problemLabels.length === 0 ||
    problemLabels.some((label) => !/^[A-Z][0-9]?$/i.test(label))
  ) {
    return stagedScoreboard(
      edition,
      'ScoreLATAM score table has an unsupported header layout.',
      mexicoGroupId,
    );
  }
  const globalRows = tableRows.filter((row) =>
    (attribute(row, 'class') ?? '')
      .split(/\s+/)
      .includes(`sitegroup${String(globalGroup.groupId)}`),
  );
  const globalPlaces = new Map<string, number>();
  for (const [tableRowIndex, row] of tableRows.entries()) {
    if (!globalRows.includes(row)) {
      continue;
    }
    const cells = elementChildren(row, 'td');
    if (cells.length !== headers.length) {
      return stagedScoreboard(
        edition,
        'A global scoreboard row has an unexpected number of cells.',
        mexicoGroupId,
        problemLabels,
      );
    }
    const userSite = parseUserSite(cells[1]);
    const place = nonnegativeInteger(normalizedText(cells[0]));
    if (userSite === null || place === undefined || place === 0) {
      return stagedScoreboard(
        edition,
        `Global scoreboard row ${String(tableRowIndex + 1)} has an invalid rank or User/Site value.`,
        mexicoGroupId,
        problemLabels,
      );
    }
    const previousPlace = globalPlaces.get(userSite.sourceUserSite);
    if (previousPlace !== undefined && previousPlace !== place) {
      return stagedScoreboard(
        edition,
        `Global rank for ${userSite.sourceUserSite} is ambiguous.`,
        mexicoGroupId,
        problemLabels,
      );
    }
    globalPlaces.set(userSite.sourceUserSite, place);
  }

  const mexicoRows = tableRows.flatMap((row, tableRowIndex) => {
    const classes = (attribute(row, 'class') ?? '').split(/\s+/);
    return classes.includes(`sitegroup${String(mexicoGroupId)}`) ? [{ row, tableRowIndex }] : [];
  });
  if (mexicoRows.length === 0) {
    return stagedScoreboard(
      edition,
      'The Mexico-only score group has no rows.',
      mexicoGroupId,
      problemLabels,
    );
  }

  const warnings: string[] = [];
  const parsedRows: ScoreLATAMMexicoRow[] = [];
  const rowsBySourceId = new Map<string, ScoreLATAMMexicoRow>();
  for (const { row, tableRowIndex } of mexicoRows) {
    const cells = elementChildren(row, 'td');
    if (cells.length !== headers.length) {
      return stagedScoreboard(
        edition,
        `Mexico scoreboard row ${String(tableRowIndex + 1)} has an unexpected number of cells.`,
        mexicoGroupId,
        problemLabels,
      );
    }
    const userSite = parseUserSite(cells[1]);
    if (userSite?.sourceUserSite.endsWith('/MX') !== true) {
      return stagedScoreboard(
        edition,
        `Mexico score group row ${String(tableRowIndex + 1)} does not have the exact /MX User/Site suffix.`,
        mexicoGroupId,
        problemLabels,
      );
    }
    const mexicoPlace = nonnegativeInteger(normalizedText(cells[0]));
    const latamPlace = globalPlaces.get(userSite.sourceUserSite);
    const totalCell = cells.at(-1);
    if (totalCell === undefined) {
      return stagedScoreboard(
        edition,
        `Mexico scoreboard row ${String(tableRowIndex + 1)} has no Total cell.`,
        mexicoGroupId,
        problemLabels,
      );
    }
    const publishedTotals = parsePublishedTotal(totalCell);
    if (mexicoPlace === undefined || mexicoPlace === 0 || latamPlace === undefined) {
      return stagedScoreboard(
        edition,
        `Mexico score group row ${String(tableRowIndex + 1)} is missing a verifiable local or global rank.`,
        mexicoGroupId,
        problemLabels,
      );
    }
    if (publishedTotals === null) {
      return stagedScoreboard(
        edition,
        `Mexico score group row ${String(tableRowIndex + 1)} has an unrecognized Total cell.`,
        mexicoGroupId,
        problemLabels,
      );
    }

    const parsedResults = cells.slice(3, -1).map(parseScoreCell);
    const resultsAreComplete = parsedResults.every(
      (result): result is ScoreLATAMProblemResult => result !== null,
    );
    if (!resultsAreComplete) {
      warnings.push(
        `Problem detail for ${userSite.sourceUserSite} is incomplete; published totals were retained.`,
      );
    }
    const rawName = normalizedText(cells[2])
      .replace(/\s*Qualified for Programadores de America in .+$/i, '')
      .replace(/\s*🎖️\s*$/u, '')
      .trim();
    const schoolMatch = /^\[([^\]]+)\]\s*(.*)$/.exec(rawName);
    const teamName = schoolMatch === null ? rawName : schoolMatch[2].trim();
    if (teamName.length === 0) {
      return stagedScoreboard(
        edition,
        `Mexico score group row ${String(tableRowIndex + 1)} has no team name.`,
        mexicoGroupId,
        problemLabels,
      );
    }
    const evidence = [
      scoreLATAMEvidence(
        parsedRows.length,
        'mexicoPlace',
        tableRowIndex,
        0,
        normalizedText(cells[0]),
      ),
      scoreLATAMEvidence(
        parsedRows.length,
        'sourceUserSite',
        tableRowIndex,
        1,
        userSite.sourceUserSite,
      ),
      scoreLATAMEvidence(parsedRows.length, 'name', tableRowIndex, 2, rawName),
      scoreLATAMEvidence(
        parsedRows.length,
        'publishedTotals',
        tableRowIndex,
        headers.length - 1,
        normalizedText(totalCell),
      ),
      scoreLATAMEvidence(parsedRows.length, 'latamPlace', tableRowIndex, 0, String(latamPlace)),
      ...cells
        .slice(3, -1)
        .map((cell, problemIndex) =>
          scoreLATAMEvidence(
            parsedRows.length,
            `results.${problemLabels[problemIndex]}`,
            tableRowIndex,
            problemIndex + 3,
            normalizedText(cell),
          ),
        ),
    ];
    const extractedRow: ScoreLATAMMexicoRow = {
      mexicoPlace,
      latamPlace,
      sourceTeamId: userSite.sourceTeamId,
      sourceUserSite: userSite.sourceUserSite,
      teamName,
      schoolName: schoolMatch === null ? null : schoolMatch[1].trim(),
      results: resultsAreComplete ? parsedResults : null,
      publishedTotals,
      evidence,
    };
    const previousRow = rowsBySourceId.get(extractedRow.sourceTeamId);
    if (previousRow !== undefined) {
      if (
        JSON.stringify(comparableMexicoRow(previousRow)) !==
        JSON.stringify(comparableMexicoRow(extractedRow))
      ) {
        return stagedScoreboard(
          edition,
          `Duplicate Mexico scoreboard rows for ${userSite.sourceUserSite} disagree.`,
          mexicoGroupId,
          problemLabels,
        );
      }
      warnings.push(`Duplicate representation for ${userSite.sourceUserSite} was deduplicated.`);
      continue;
    }
    rowsBySourceId.set(extractedRow.sourceTeamId, extractedRow);
    parsedRows.push(extractedRow);
  }

  if (!isStandardCompetitionRanking(parsedRows.map(({ mexicoPlace }) => mexicoPlace))) {
    return stagedScoreboard(
      edition,
      'Mexico-local places do not use standard competition ranking.',
      mexicoGroupId,
      problemLabels,
    );
  }
  const publicationState = nodes.some(
    (node) =>
      isElement(node) &&
      /^(?:h[1-6]|b|strong)$/.test(node.tagName) &&
      normalizedText(node) === 'Final Scoreboard',
  )
    ? 'final'
    : 'unknown';
  return {
    status: 'ready',
    reason: null,
    publicationState,
    editionYear: edition.editionYear,
    playedYear: edition.playedYear,
    sourceEditionLabel: edition.sourceEditionLabel,
    scoreboardUrl: edition.url,
    mexicoGroupId,
    eventEquivalence: 'reviewer-approved',
    problemLabels,
    rows: parsedRows,
    coverage: { rowCount: parsedRows.length, rowsComplete: true, paginationComplete: true },
    warnings: [...new Set(warnings)],
  };
};
