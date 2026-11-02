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
  it('prefers the explicit team column when the institution is listed first', () => {
    const result = parseITESOAccumulatedDocument(
      [
        page(1, 'text', [
          tableRow(['Rank', 'ID Equipo', 'Institución', 'Equipo', 'Acumulado']),
          tableRow(['1', '1068692', 'Institución Alfa', 'Equipo Alfa', '440']),
        ]),
      ],
      'Gran Premio de México 2025',
    );

    expect(result).toMatchObject({
      status: 'ready',
      rows: [{ place: 1, teamName: 'Equipo Alfa', schoolName: 'Institución Alfa', score: 440 }],
    });
  });

  it('preserves every source row while staging repeated places for review', () => {
    const result = parseITESOAccumulatedDocument(
      [
        page(1, 'text', [
          header,
          tableRow(['1', 'Equipo Alfa', '12', '']),
          tableRow(['1', 'Equipo Beta', '12', '']),
        ]),
      ],
      'Resultado acumulado',
    );

    expect(result).toMatchObject({
      status: 'staged',
      rows: [
        { place: 1, teamName: 'Equipo Alfa' },
        { place: 1, teamName: 'Equipo Beta' },
      ],
      reason: 'place 1 appears more than once',
    });
  });

  it('reads the accumulated score from a second header row without confusing event columns', () => {
    const result = parseITESOAccumulatedDocument(
      [
        page(1, 'text', [
          tableRow(['No', 'Equipo', 'Centro Universitario', 'Gran Premio México & CA', 'Fase I']),
          tableRow(['', '', '', 'Acumulado', 'Septiembre de 2015']),
          tableRow(['', '', '', 'Puntos', 'Puntos']),
          tableRow(['1', 'UNAM 1', 'Universidad Nacional Autónoma de México', '95', '17']),
        ]),
      ],
      'Gran Premio México & CA 2015',
    );

    expect(result).toMatchObject({
      status: 'ready',
      scoreUnit: 'Puntos',
      rows: [
        {
          place: 1,
          teamName: 'UNAM 1',
          schoolName: 'Universidad Nacional Autónoma de México',
          score: 95,
        },
      ],
    });
  });

  it('recognizes historical dates without years and preserves source annotations', () => {
    const annotation =
      'En tercera fecha, se retiro el resultado a un equipo por integrante no elegible.';
    const result = parseITESOAccumulatedDocument(
      [
        page(1, 'text', [
          tableRow(['No', 'Equipo', 'Instiución', 'Acumulado', 'Primera Fecha']),
          tableRow(['', '', '', '', '28 de abril']),
          tableRow(['', '', '', 'Puntos', 'Puntos']),
          tableRow(['1', 'Equipo Alfa', 'Institución Alfa', '95', '95']),
          tableRow(['', annotation, '', '', '']),
        ]),
      ],
      'Acumulado Primera Fecha Segunda Fecha Tercera Fecha',
    );

    expect(result).toMatchObject({
      status: 'ready',
      snapshot: 'unconfirmed',
      rows: [{ place: 1, teamName: 'Equipo Alfa', schoolName: 'Institución Alfa', score: 95 }],
    });
    expect(result.warnings).toContain(`Source annotation on page 1: ${annotation}`);
  });

  it('does not discard unidentified rows or partially populated annotations', () => {
    for (const cells of [
      ['', 'Equipo sin lugar ni puntos', '', ''],
      ['', 'En tercera fecha, Equipo Alfa', '10', ''],
    ]) {
      const result = parseITESOAccumulatedDocument(
        [page(1, 'text', [header, tableRow(['1', 'Equipo Alfa', '12', 'Sí']), tableRow(cells)])],
        'Resultado acumulado',
      );
      expect(result.status).toBe('staged');
    }
  });

  it('reads an accumulated score from a multi-row ITESO standings header', () => {
    const accumulatedHeader = tableRow([
      'No',
      'Id',
      'Equipo',
      'Institución',
      'Sede',
      'Estado',
      'Acumulado',
      '',
      '',
      'Primera Fecha',
      '',
      '',
      'Segunda Fecha',
      '',
      '',
      'Tercera Fecha',
      '',
      '',
      'Puntos Comunidad',
    ]);
    const dates = tableRow([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '4 de Mayo de 2019',
      '',
      '',
      '11 de Mayo de 2019',
      '',
      '',
      '14 de Septiembre de 2019',
      '',
      '',
      '',
    ]);
    const metrics = tableRow([
      '',
      '',
      '',
      '',
      '',
      '',
      'Puntos',
      'Problemas',
      'Tiempo',
      'Puntos',
      'Problemas',
      'Tiempo',
      'Puntos',
      'Problemas',
      'Tiempo',
      'Puntos',
      'Problemas',
      'Tiempo',
      '',
    ]);
    const firstTeam = tableRow([
      '1',
      '409464',
      'Norman is Hunting',
      'Escuela Superior De Computo Instituto Politecnico Nacional',
      'FES Acatlán UNAM - ESCOM IPN',
      'Ciudad México',
      '446',
      '28',
      '2665',
      '95',
      '9',
      '1123',
      '150',
      '10',
      '766',
      '200',
      '9',
      '776',
      '1',
    ]);
    const secondTeam = tableRow([
      '2',
      '409145',
      'We put the D in DP',
      'ITESM Campus Monterrey',
      'ITESM Monterrey',
      'Nuevo León',
      '424',
      '25',
      '3250',
      '88',
      '8',
      '1103',
      '140',
      '8',
      '784',
      '195',
      '9',
      '1363',
      '1',
    ]);
    const result = parseITESOAccumulatedDocument(
      [
        page(1, 'text', [
          tableRow(['Gran Premio de México 2019']),
          accumulatedHeader,
          dates,
          metrics,
          firstTeam,
        ]),
        page(2, 'text', [secondTeam]),
      ],
      'Gran Premio de México 2019 — Resultado acumulado tercera fecha',
    );

    expect(result).toMatchObject({
      status: 'ready',
      pageNumbers: [1, 2],
      scoreUnit: 'Puntos',
      snapshot: 'unconfirmed',
      rows: [
        {
          place: 1,
          teamName: 'Norman is Hunting',
          schoolName: 'Escuela Superior De Computo Instituto Politecnico Nacional',
          score: 446,
        },
        {
          place: 2,
          teamName: 'We put the D in DP',
          schoolName: 'ITESM Campus Monterrey',
          score: 424,
        },
      ],
    });
  });

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
    expect(classifyITESOSnapshot('Resultado final')).toBe('unconfirmed');
    expect(classifyITESOSnapshot('Resultado acumulado tercera fecha')).toBe('unconfirmed');
    expect(
      classifyITESOSnapshot(
        'Gran Premio 2016\nPrimera Fecha Segunda Fecha Tercera Fecha Cuarta Fecha',
      ),
    ).toBe('unconfirmed');
    expect(
      classifyITESOSnapshot(
        'Standing a la fecha de la segunda fecha\nPrimera Fecha Segunda Fecha Tercera Fecha',
      ),
    ).toBe('intermediate');
    expect(
      classifyITESOSnapshot('Resultado final oficial\nPrimera Fecha Segunda Fecha Tercera Fecha'),
    ).toBe('latest-explicit');
  });
});
