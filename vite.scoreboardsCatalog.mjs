import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDirectory = fileURLToPath(new URL('./data/', import.meta.url));

const listFiles = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? listFiles(file) : [file];
  });

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read scoreboard catalog source ${file}.`, { cause: error });
  }
};

const buildCatalog = (source) => {
  const root = source === 'archive' ? dataDirectory : path.join(dataDirectory, 'mock');
  const contests = [];
  const seasonStandings = [];

  for (const file of listFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const match = /^seasons\/\d{4}\/[a-z0-9]+(?:-[a-z0-9]+)*\/([^/]+)\.json$/.exec(relative);
    if (match === null) {
      continue;
    }

    const record = readJson(file);
    if (match[1] === 'standing') {
      const { rows: _rows, ...entry } = record;
      seasonStandings.push(entry);
    } else {
      const { standings: _standings, ...entry } = record;
      contests.push(entry);
    }
  }

  return {
    contests: contests.toSorted((a, b) => a.id.localeCompare(b.id)),
    seasonStandings: seasonStandings.toSorted(
      (a, b) => b.seasonYear - a.seasonYear || a.seriesId.localeCompare(b.seriesId),
    ),
  };
};

const moduleId = 'virtual:scoreboards-catalog';
const resolvedModuleId = `\0${moduleId}`;

export const scoreboardsCatalogPlugin = () => {
  const archiveCatalog = buildCatalog('archive');
  const mockCatalog = buildCatalog('mock');
  return {
    name: 'scoreboards-catalog',
    resolveId(id) {
      return id === moduleId ? resolvedModuleId : undefined;
    },
    load(id) {
      return id === resolvedModuleId
        ? `const archiveCatalog = ${JSON.stringify(archiveCatalog)};
const mockCatalog = ${JSON.stringify(mockCatalog)};
export const scoreboardsCatalog = import.meta.env.DEV && import.meta.env.VITE_DATA_SOURCE !== 'archive'
  ? mockCatalog
  : archiveCatalog;`
        : undefined;
    },
  };
};
