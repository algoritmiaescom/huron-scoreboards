export interface ITESOExtractedTableRow {
  cells: string[];
  confidences: (number | null)[];
}

export interface ITESOExtractedPage {
  pageNumber: number;
  method: 'text' | 'ocr';
  text: string;
  tables: { rows: ITESOExtractedTableRow[] }[];
}

export interface ITESOAccumulatedRow {
  place: number;
  teamName: string;
  score: number;
  scoreText: string;
  scoreUnit: string;
  qualificationText: string | null;
  qualified: boolean | null;
  pageNumber: number;
  confidence: number | null;
  evidence: { field: string; cell: string }[];
}

export type ITESOSnapshotStatus = 'intermediate' | 'latest-explicit' | 'unconfirmed';

export type ITESOAccumulatedExtraction =
  | {
      status: 'ready';
      rows: ITESOAccumulatedRow[];
      pageNumbers: number[];
      scoreUnit: string;
      snapshot: ITESOSnapshotStatus;
      warnings: string[];
    }
  | {
      status: 'staged';
      rows: ITESOAccumulatedRow[];
      pageNumbers: number[];
      warnings: string[];
      reason: string;
    };

interface TableColumns {
  place: number;
  team: number;
  score: number;
  qualification: number | null;
  scoreUnit: string;
  fingerprint: string;
}

interface ParsedTableRow {
  pageNumber: number;
  method: ITESOExtractedPage['method'];
  row: ITESOExtractedTableRow;
  columns: TableColumns;
}

const normalizedCell = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const findColumn = (cells: readonly string[], pattern: RegExp): number =>
  cells.findIndex((cell) => pattern.test(normalizedCell(cell)));

const columnsFromHeader = (row: ITESOExtractedTableRow): TableColumns | undefined => {
  const place = findColumn(row.cells, /^(?:#|lugar|posicion|puesto|place|rank)$/);
  const team = findColumn(row.cells, /^(?:equipo|team|school|universidad|institucion)$/);
  const score = findColumn(row.cells, /^(?:puntos?|points?|puntaje|score|acumulado)$/);
  const qualification = findColumn(
    row.cells,
    /^(?:clasifica(?:cion)?|califica(?:cion)?|qualified|qualification|avanza)$/,
  );
  if (place < 0 || team < 0 || score < 0 || new Set([place, team, score]).size !== 3) {
    return undefined;
  }
  return {
    place,
    team,
    score,
    qualification: qualification < 0 ? null : qualification,
    scoreUnit: row.cells[score].trim(),
    fingerprint: row.cells.map(normalizedCell).join('|'),
  };
};

const numericCell = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const minimum = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((lowest, value) => Math.min(lowest, value), 1);
};

const qualificationValue = (value: string): boolean | null | undefined => {
  const normalized = normalizedCell(value).replace(/[.!]/g, '');
  if (normalized.length === 0 || /^(?:pendiente|por definir|unknown|n\/a)$/.test(normalized)) {
    return null;
  }
  if (/^(?:si|califica|clasifica|qualified|qualifies|true|1|avanza)$/.test(normalized)) {
    return true;
  }
  if (/^(?:no|no califica|no clasifica|not qualified|false|0|no avanza)$/.test(normalized)) {
    return false;
  }
  return undefined;
};

export const classifyITESOSnapshot = (label: string): ITESOSnapshotStatus => {
  const normalized = normalizedCell(label);
  if (/\b(?:primera|segunda|1(?:a|ra)?|2(?:a|da)?)\s+fecha\b/.test(normalized)) {
    return 'intermediate';
  }
  if (/\b(?:resultado|standing)\s+(?:oficial\s+)?final\b/.test(normalized)) {
    return 'latest-explicit';
  }
  return 'unconfirmed';
};

export const parseITESOAccumulatedDocument = (
  pages: readonly ITESOExtractedPage[],
  snapshotLabel: string,
  minimumOcrConfidence = 0.9,
): ITESOAccumulatedExtraction => {
  const rows: ParsedTableRow[] = [];
  const warnings: string[] = [];
  let activeColumns: TableColumns | undefined;
  const headerFingerprints = new Set<string>();
  let ambiguousTableCount = 0;

  for (const page of pages) {
    for (const table of page.tables) {
      const tableHeaders = table.rows
        .map((row, index) => ({ columns: columnsFromHeader(row), index }))
        .filter(
          (entry): entry is { columns: TableColumns; index: number } => entry.columns !== undefined,
        );
      if (tableHeaders.length > 1) {
        ambiguousTableCount += 1;
        continue;
      }
      const header = tableHeaders.at(0);
      let startIndex = 0;
      if (header !== undefined) {
        activeColumns = header.columns;
        headerFingerprints.add(header.columns.fingerprint);
        startIndex = header.index + 1;
      } else if (activeColumns === undefined) {
        continue;
      }
      for (const [index, row] of table.rows.entries()) {
        if (index < startIndex || row.cells.every((cell) => cell.trim().length === 0)) {
          continue;
        }
        if (columnsFromHeader(row)?.fingerprint !== undefined) {
          continue;
        }
        rows.push({
          pageNumber: page.pageNumber,
          method: page.method,
          row,
          columns: activeColumns,
        });
      }
    }
  }

  if (ambiguousTableCount > 0) {
    warnings.push(`${String(ambiguousTableCount)} tables contain multiple standings header rows.`);
  }
  if (headerFingerprints.size > 1) {
    warnings.push('Page headers use different column layouts; automatic joining needs review.');
  }

  const extractedRows: ITESOAccumulatedRow[] = [];
  const failures: string[] = [];
  const seenPlaces = new Set<number>();
  for (const [index, entry] of rows.entries()) {
    const { row, columns } = entry;
    const placeText = row.cells[columns.place]?.trim() ?? '';
    const teamName = row.cells[columns.team]?.trim() ?? '';
    const scoreText = row.cells[columns.score]?.trim() ?? '';
    const place = numericCell(placeText);
    const score = numericCell(scoreText);
    if (
      place === undefined ||
      !Number.isInteger(place) ||
      teamName.length === 0 ||
      score === undefined
    ) {
      failures.push(
        `page ${String(entry.pageNumber)} row ${String(index + 1)} has an ambiguous place, team, or score cell`,
      );
      continue;
    }
    if (seenPlaces.has(place)) {
      failures.push(`place ${String(place)} appears more than once`);
      continue;
    }
    seenPlaces.add(place);
    const qualificationText =
      columns.qualification === null ? null : (row.cells[columns.qualification]?.trim() ?? '');
    const qualified = qualificationText === null ? null : qualificationValue(qualificationText);
    if (qualified === undefined) {
      failures.push(`page ${String(entry.pageNumber)} has an unrecognized qualification value`);
    }
    const evidenceIndexes = [
      columns.place,
      columns.team,
      columns.score,
      ...(columns.qualification === null ? [] : [columns.qualification]),
    ];
    const confidenceValues = evidenceIndexes.flatMap((cellIndex) => {
      const value = row.confidences[cellIndex];
      return value === null ? [] : [value];
    });
    const confidence = minimum(confidenceValues);
    if (
      entry.method === 'ocr' &&
      (confidenceValues.length !== evidenceIndexes.length ||
        confidence === null ||
        confidence < minimumOcrConfidence)
    ) {
      failures.push(
        `page ${String(entry.pageNumber)} row ${String(index + 1)} has low OCR confidence`,
      );
    }
    extractedRows.push({
      place,
      teamName,
      score,
      scoreText,
      scoreUnit: columns.scoreUnit,
      qualificationText,
      qualified: qualified ?? null,
      pageNumber: entry.pageNumber,
      confidence,
      evidence: [
        { field: 'place', cell: placeText },
        { field: 'teamName', cell: teamName },
        { field: 'score', cell: scoreText },
        ...(qualificationText === null
          ? []
          : [{ field: 'qualification', cell: qualificationText }]),
      ],
    });
  }

  if (extractedRows.length === 0) {
    failures.push('no table with recognized place, team, and score headers was found');
  }
  if (headerFingerprints.size !== 1) {
    failures.push('a single consistent standings table header was not found');
  }
  const pageNumbers = [...new Set(rows.map(({ pageNumber }) => pageNumber))];
  const scoreUnits = new Set(extractedRows.map(({ scoreUnit }) => scoreUnit));
  if (scoreUnits.size > 1) {
    failures.push('score unit labels differ between pages');
  }
  const snapshot = classifyITESOSnapshot(snapshotLabel);
  if (snapshot === 'unconfirmed') {
    warnings.push(
      'The source does not explicitly identify this document as the latest official result.',
    );
  }
  if (failures.length > 0) {
    return {
      status: 'staged',
      rows: extractedRows,
      pageNumbers,
      warnings,
      reason: [...new Set(failures)].join('; '),
    };
  }
  return {
    status: 'ready',
    rows: extractedRows,
    pageNumbers,
    scoreUnit: [...scoreUnits][0],
    snapshot,
    warnings,
  };
};
