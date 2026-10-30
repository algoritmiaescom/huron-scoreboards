import { describe, expect, it } from 'vitest';

import { classifyITESOSnapshot, parseITESOAccumulatedDocument } from './iteso-document';

import type { ITESOExtractedPage, ITESOExtractedTableRow } from './iteso-document';

const tableRow = (cells: string[], confidences: (number | null)[] = cells.map(() => null)) => ({
  cells,
  confidences,
});

const page = (
  pageNumber: number,
  method: ITESOExtractedPage['method'],
  rows: ITESOExtractedTableRow[],
): ITESOExtractedPage => ({
  pageNumber,
  method,
  text: '',
  tables: [{ rows }],
});

const header = tableRow(['Lugar', 'Equipo', 'Puntos', 'Clasifica']);

describe('ITESO accumulated document extraction', () => {
  it('joins multi-page tables, removes repeated headers, and preserves units and qualification', () => {
    const result = parseITESOAccumulatedDocument(
      [
        page(1, 'text', [header, tableRow(['1', 'Equipo Alfa', '12.5', 'Sí'])]),
        page(2, 'text', [header, tableRow(['2', 'Equipo Beta', '9.25', 'No'])]),
      ],
      'Resultado acumulado del Gran Premio',
    );

    expect(result).toMatchObject({
      status: 'ready',
      pageNumbers: [1, 2],
      scoreUnit: 'Puntos',
      snapshot: 'unconfirmed',
      rows: [
        {
          place: 1,
          teamName: 'Equipo Alfa',
          score: 12.5,
          scoreText: '12.5',
          scoreUnit: 'Puntos',
          qualificationText: 'Sí',
          qualified: true,
          pageNumber: 1,
        },
        {
          place: 2,
          teamName: 'Equipo Beta',
          score: 9.25,
          scoreText: '9.25',
          scoreUnit: 'Puntos',
          qualificationText: 'No',
          qualified: false,
          pageNumber: 2,
        },
      ],
    });
  });

  it('stages ambiguous score digits instead of guessing decimal or thousands separators', () => {
    const result = parseITESOAccumulatedDocument(
      [page(1, 'text', [header, tableRow(['1', 'Equipo Alfa', '1,250', 'Sí'])])],
      'Resultado final oficial',
    );

    expect(result).toMatchObject({ status: 'staged' });
    if (result.status === 'staged') {
      expect(result.reason).toContain('ambiguous place, team, or score cell');
    }
  });

  it('stages low-confidence OCR rows and rejects unknown qualification annotations', () => {
    const lowConfidence = parseITESOAccumulatedDocument(
      [
        page(1, 'ocr', [
          tableRow(['Lugar', 'Equipo', 'Puntos', 'Clasifica'], [0.99, 0.99, 0.99, 0.99]),
          tableRow(['1', 'Equipo Alfa', '12', 'Tal vez'], [0.99, 0.99, 0.75, 0.99]),
        ]),
      ],
      'Resultado acumulado',
    );

    expect(lowConfidence).toMatchObject({ status: 'staged' });
    if (lowConfidence.status === 'staged') {
      expect(lowConfidence.reason).toContain('unrecognized qualification value');
      expect(lowConfidence.reason).toContain('low OCR confidence');
    }
  });

  it('classifies only explicit intermediate and final language', () => {
    expect(classifyITESOSnapshot('Standing a la fecha de la segunda fecha')).toBe('intermediate');
    expect(classifyITESOSnapshot('Resultado final oficial')).toBe('latest-explicit');
    expect(classifyITESOSnapshot('Resultado acumulado tercera fecha')).toBe('unconfirmed');
  });
});
