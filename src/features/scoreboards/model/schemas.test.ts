import { describe, expect, it } from 'vitest';

import { contestSchema, contestStageSchema, schoolSchema, standingRowSchema } from './schemas';
import { scoreStandingRow, selectFirstSolves } from './scoring';
import { contestStageLabel } from './selectors';

describe('contest stages', () => {
  it('keeps Fecha 0 distinct from the qualifying stages', () => {
    expect(contestStageSchema.parse('fecha-0')).toBe('fecha-0');
    expect(contestStageLabel('fecha-0')).toBe('Fecha 0');
    expect(contestStageLabel('qualifier-1')).toBe('Clasificatoria 1');
  });
});

const historicalContest = {
  id: '2000-gpm-fecha-0',
  seasonYear: 2000,
  seriesId: 'gpm',
  stage: 'fecha-0',
  name: 'Historical fixture',
  date: null,
  durationMinutes: null,
  penaltyMinutesPerFailedAttempt: null,
  problems: [{ label: 'A' }],
  standings: [
    { place: 1, teamId: '2000-alpha', results: null, publishedTotals: { solved: 1, penalty: 50 } },
  ],
  source: 'https://example.com/standings',
};

describe('partial historical standings', () => {
  it('uses a published penalty when the rule is unknown, without inventing a rule', () => {
    const contest = contestSchema.parse({
      ...historicalContest,
      standings: [
        {
          place: 1,
          teamId: '2000-alpha',
          results: [{ status: 'solved', attempts: 2, solvedAtMinute: 30 }],
          publishedTotals: { solved: 1, penalty: 50 },
        },
      ],
    });
    expect(scoreStandingRow(contest.standings[0], null)).toEqual({ solved: 1, penalty: 50 });
    expect(contest.penaltyMinutesPerFailedAttempt).toBeNull();
  });

  it('accepts matching observations but keeps computed totals authoritative', () => {
    const contest = contestSchema.parse({
      ...historicalContest,
      penaltyMinutesPerFailedAttempt: 20,
      standings: [
        {
          place: 1,
          teamId: '2000-alpha',
          results: [{ status: 'solved', attempts: 2, solvedAtMinute: 30 }],
          publishedTotals: { solved: 1, penalty: null },
        },
      ],
    });
    expect(scoreStandingRow(contest.standings[0], 20)).toEqual({ solved: 1, penalty: 50 });
  });
  it('retains explicit unknown metadata and published totals without inventing results', () => {
    const contest = contestSchema.parse(historicalContest);
    expect(contest.date).toBeNull();
    expect(contest.durationMinutes).toBeNull();
    expect(contest.penaltyMinutesPerFailedAttempt).toBeNull();
    expect(contest.standings[0].results).toBeNull();
    expect(scoreStandingRow(contest.standings[0], null)).toEqual({ solved: 1, penalty: 50 });
  });

  it('requires published totals when problem results are unavailable', () => {
    expect(
      standingRowSchema.safeParse({ place: 1, teamId: '2000-alpha', results: null }).success,
    ).toBe(false);
  });

  it('allows an unknown problem set only for totals-only rows', () => {
    expect(contestSchema.safeParse({ ...historicalContest, problems: [] }).success).toBe(true);
    expect(
      contestSchema.safeParse({
        ...historicalContest,
        problems: [],
        standings: [{ place: 1, teamId: '2000-alpha', results: [] }],
      }).success,
    ).toBe(false);
  });

  it('does not claim first solves when some teams have no problem details', () => {
    const contest = contestSchema.parse({
      ...historicalContest,
      standings: [
        ...historicalContest.standings,
        {
          place: 2,
          teamId: '2000-beta',
          results: [{ status: 'solved', attempts: 2, solvedAtMinute: 30 }],
        },
      ],
    });
    expect(selectFirstSolves(contest).size).toBe(0);
    expect(scoreStandingRow(contest.standings[1], null)).toEqual({ solved: 1, penalty: null });
  });

  it.each([
    { solved: 0, penalty: 50 },
    { solved: 1, penalty: 49 },
    { solved: 2, penalty: 50 },
  ])('rejects contradictory published totals %j', (publishedTotals) => {
    expect(
      contestSchema.safeParse({
        ...historicalContest,
        penaltyMinutesPerFailedAttempt: 20,
        standings: [
          {
            place: 1,
            teamId: '2000-alpha',
            results: [{ status: 'solved', attempts: 2, solvedAtMinute: 30 }],
            publishedTotals,
          },
        ],
      }).success,
    ).toBe(false);
  });
});

const school = {
  id: 'ipn-escom',
  officialName: 'Escuela Superior de Cómputo',
  shortName: 'ESCOM',
};

const parseLogo = (logo: string) => schoolSchema.safeParse({ ...school, logo });

describe('schoolSchema logo', () => {
  it('is optional, because most schools have no logo on file', () => {
    const result = schoolSchema.safeParse(school);

    expect(result.success).toBe(true);
    expect(result.data?.logo).toBeUndefined();
  });

  it.each(['logos/ipn-escom.svg', 'logos/udg-cucei.png', 'logos/unam.webp'])(
    'accepts the committed logo path %s',
    (logo) => {
      expect(parseLogo(logo).success).toBe(true);
    },
  );

  it('accepts a remote https logo', () => {
    expect(parseLogo('https://example.com/logo.svg').success).toBe(true);
  });

  it.each([
    // Rendered as an image source, so a scheme that can execute must never validate.
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1) />',
    // Would load as mixed content.
    'http://example.com/logo.png',
    // Must stay inside public/logos.
    '../../etc/passwd',
    'logos/../../secrets.svg',
    '/logos/ipn-escom.svg',
    'public/logos/ipn-escom.svg',
    // Filenames are slugs with a known image extension.
    'logos/Bad_Name.svg',
    'logos/ipn-escom.JPG',
    'logos/ipn-escom.exe',
    'logos/ipn-escom',
  ])('rejects %s', (logo) => {
    expect(parseLogo(logo).success).toBe(false);
  });
});
