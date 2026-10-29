import { randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { identityAliasRegistrySchema } from '@/features/scoreboards/ingestion/identities';
import { sourceConfigurationSchema } from '@/features/scoreboards/ingestion/schemas';
import { contestStageSchema, seasonYearSchema } from '@/features/scoreboards/model/schemas';
import { createJsonScoreboardsRepository } from '@/features/scoreboards/repositories/scoreboardsRepository';

import { createReviewProposal, writeProposalAtomically } from './operator';

import type { JsonFiles } from '@/lib/data/repository';

const MAX_CANDIDATE_FILES = 100;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_CANDIDATE_BYTES = 256 * 1024 * 1024;
const MAX_CANDIDATE_RECORDS = 1000;

interface CliOptions {
  sourceId?: string;
  seasonYear?: number;
  seriesId?: string;
  stage?: string;
  outputDirectory: string;
  candidateFiles: string[];
}

const parseCliOptions = (argv: string[]): CliOptions => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      source: { type: 'string' },
      season: { type: 'string' },
      series: { type: 'string' },
      stage: { type: 'string' },
      'output-dir': { type: 'string', default: '.standings-ingestion/proposals' },
    },
  });
  if (positionals.length === 0 || positionals.length > MAX_CANDIDATE_FILES) {
    throw new Error(`Provide between 1 and ${String(MAX_CANDIDATE_FILES)} candidate JSON files.`);
  }
  let seasonYear: number | undefined;
  if (values.season !== undefined) {
    const parsedYear = seasonYearSchema.safeParse(Number(values.season));
    if (!parsedYear.success) {
      throw new Error('--season must be an integer between 1990 and 2100.');
    }
    seasonYear = parsedYear.data;
  }
  if (values.stage !== undefined && !contestStageSchema.safeParse(values.stage).success) {
    throw new Error('--stage must be a supported contest stage.');
  }
  return {
    ...(values.source === undefined ? {} : { sourceId: values.source }),
    ...(seasonYear === undefined ? {} : { seasonYear }),
    ...(values.series === undefined ? {} : { seriesId: values.series }),
    ...(values.stage === undefined ? {} : { stage: values.stage }),
    outputDirectory: values['output-dir'],
    candidateFiles: positionals,
  };
};

const readBoundedJson = async (filePath: string): Promise<unknown> => {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size > MAX_INPUT_BYTES) {
    throw new Error(`Input file exceeds the ${String(MAX_INPUT_BYTES)} byte limit: ${filePath}`);
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
};

const loadCandidateFiles = async (files: readonly string[]): Promise<unknown[]> => {
  const candidates: unknown[] = [];
  let totalBytes = 0;
  for (const file of files) {
    const fileStats = await stat(file);
    if (!fileStats.isFile() || fileStats.size > MAX_INPUT_BYTES) {
      throw new Error(`Candidate file exceeds the ${String(MAX_INPUT_BYTES)} byte limit: ${file}`);
    }
    totalBytes += fileStats.size;
    if (totalBytes > MAX_TOTAL_CANDIDATE_BYTES) {
      throw new Error(
        `Candidate inputs exceed the ${String(MAX_TOTAL_CANDIDATE_BYTES)} byte run limit.`,
      );
    }
    const value = JSON.parse(await readFile(file, 'utf8')) as unknown;
    if (Array.isArray(value)) {
      for (const candidate of value as unknown[]) {
        candidates.push(candidate);
      }
    } else {
      candidates.push(value);
    }
    if (candidates.length > MAX_CANDIDATE_RECORDS) {
      throw new Error(
        `Candidate input exceeds the ${String(MAX_CANDIDATE_RECORDS)} record run limit.`,
      );
    }
  }
  return candidates;
};

const loadArchiveFiles = async (root: string): Promise<JsonFiles> => {
  const files: JsonFiles = {};
  const dataDirectory = path.join(root, 'data');
  const schoolsFile = path.join(dataDirectory, 'schools.json');
  try {
    await stat(schoolsFile);
    files['data/schools.json'] = () => readFile(schoolsFile, 'utf8');
  } catch {
    // An empty real archive may not have a schools registry yet.
  }
  const seasonsDirectory = path.join(dataDirectory, 'seasons');
  let seasons;
  try {
    seasons = await readdir(seasonsDirectory, { withFileTypes: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return files;
    }
    throw error;
  }
  for (const season of seasons.filter((entry) => entry.isDirectory())) {
    const seasonDirectory = path.join(seasonsDirectory, season.name);
    const seasonPath = `data/seasons/${season.name}`;
    for (const entry of await readdir(seasonDirectory, { withFileTypes: true })) {
      const entryPath = path.join(seasonDirectory, entry.name);
      if (entry.isFile() && entry.name === 'teams.json') {
        files[`${seasonPath}/teams.json`] = () => readFile(entryPath, 'utf8');
        continue;
      }
      if (!entry.isDirectory()) {
        continue;
      }
      for (const dataFile of await readdir(entryPath, { withFileTypes: true })) {
        if (dataFile.isFile() && dataFile.name.endsWith('.json')) {
          const absolutePath = path.join(entryPath, dataFile.name);
          files[`${seasonPath}/${entry.name}/${dataFile.name}`] = () =>
            readFile(absolutePath, 'utf8');
        }
      }
    }
  }
  return files;
};

export const runStandingsIngestion = async (
  argv: string[],
  root = process.cwd(),
): Promise<{ proposalPath: string; status: string }> => {
  const options = parseCliOptions(argv);
  const candidates = await loadCandidateFiles(options.candidateFiles);
  const [sourceConfiguration, identityRegistry] = await Promise.all([
    readBoundedJson(path.join(root, 'config/standings-sources.json')),
    readBoundedJson(path.join(root, 'config/standings-identities.json')),
  ]);
  const parsedConfiguration = sourceConfigurationSchema.parse(sourceConfiguration);
  const parsedAliases = identityAliasRegistrySchema.parse(identityRegistry);
  const archiveResult = await createJsonScoreboardsRepository(
    await loadArchiveFiles(root),
    'archive',
  ).load();
  if (archiveResult.status === 'invalid' || archiveResult.status === 'error') {
    throw new Error(`Published archive did not validate: ${JSON.stringify(archiveResult.issues)}`);
  }
  const runId = `run-${String(Date.now())}-${randomUUID()}`;
  const proposal = createReviewProposal({
    archive: archiveResult.data,
    candidates,
    sourceConfiguration: parsedConfiguration,
    identityAliases: parsedAliases.aliases,
    selection: {
      ...(options.sourceId === undefined ? {} : { sourceId: options.sourceId }),
      ...(options.seasonYear === undefined ? {} : { seasonYear: options.seasonYear }),
      ...(options.seriesId === undefined ? {} : { seriesId: options.seriesId }),
      ...(options.stage === undefined ? {} : { stage: options.stage }),
    },
    runId,
    generatedAt: new Date().toISOString(),
  });
  const proposalPath = await writeProposalAtomically(
    path.resolve(root, options.outputDirectory),
    `${runId}.json`,
    proposal,
  );
  return { proposalPath, status: proposal.status };
};
