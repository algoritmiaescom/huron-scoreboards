import type { Contest } from './schemas';
import type { StandingsFilters } from './selectors';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export const filterKeys = ['team', 'school', 'problem', 'accepted', 'first'] as const;
export type FilterKey = (typeof filterKeys)[number];

export interface FilterIssue {
  key: FilterKey;
  message: string;
}

export const isFilterKey = (key: string): key is FilterKey =>
  filterKeys.some((candidate) => candidate === key);

export const parseStandingsFilters = (
  params: URLSearchParams,
  archive: ScoreboardsArchive,
  contest: Contest,
): { filters: StandingsFilters; issues: FilterIssue[] } => {
  const filters: StandingsFilters = {};
  const issues: FilterIssue[] = [];
  for (const key of filterKeys) {
    const values = params.getAll(key);
    if (values.length === 0) {
      continue;
    }
    if (values.length > 1) {
      issues.push({ key, message: `El filtro "${key}" está repetido.` });
      continue;
    }
    const value = values[0];
    switch (key) {
      case 'team':
        if (value !== '') {
          filters.team = value;
        }
        break;
      case 'school':
        if (!archive.schools.some(({ id }) => id === value)) {
          issues.push({ key, message: `No existe la institución "${value}".` });
        } else {
          filters.school = value;
        }
        break;
      case 'problem':
        if (!contest.problems.some(({ label }) => label === value)) {
          issues.push({ key, message: `El problema "${value}" no pertenece a este concurso.` });
        } else {
          filters.problem = value;
        }
        break;
      case 'accepted':
      case 'first':
        if (value !== '1') {
          issues.push({ key, message: `El filtro "${key}" solo admite el valor "1".` });
        } else {
          filters[key] = true;
        }
        break;
    }
  }
  return { filters, issues };
};

export const updateStandingsFilter = (
  params: URLSearchParams,
  key: FilterKey,
  value: string,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  if (value === '') {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
};

export const clearStandingsFilters = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  filterKeys.forEach((key) => {
    next.delete(key);
  });
  return next;
};
