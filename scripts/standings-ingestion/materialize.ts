import { mkdir, mkdtemp, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { identityAliasRegistrySchema } from '@/features/scoreboards/ingestion/identities';
import { materializeProposal } from '@/features/scoreboards/ingestion/materialize';
import { createJsonScoreboardsRepository } from '@/features/scoreboards/repositories/scoreboardsRepository';

import { loadArchiveFiles } from './cli';
import { writeJsonAtomically } from './operator';

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_INPUT_FILES = 100;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

const readJson = async (file: string): Promise<unknown> => {
  const stats = await stat(file);
  if (!stats.isFile() || stats.size > MAX_INPUT_BYTES) {
    throw new Error(`Expected a JSON file of at most ${String(MAX_INPUT_BYTES)} bytes: ${file}`);
  }
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
};

export const materializeProposalFiles = async (
  inputPaths: readonly string[],
  root = process.cwd(),
): Promise<string[]> => {
  if (inputPaths.length === 0 || inputPaths.length > MAX_INPUT_FILES) {
    throw new Error(`Provide between 1 and ${String(MAX_INPUT_FILES)} proposal JSON files.`);
  }
  const repositoryRoot = await realpath(root);
  const files = await loadArchiveFiles(repositoryRoot);
  const archiveResult = await createJsonScoreboardsRepository(files, 'archive').load();
  if (archiveResult.status === 'invalid' || archiveResult.status === 'error') {
    throw new Error(`Published archive did not validate: ${JSON.stringify(archiveResult.issues)}`);
  }
  const sourceConfiguration = await readJson(
    path.join(repositoryRoot, 'config/standings-sources.json'),
  );
  const identityRegistry = identityAliasRegistrySchema.parse(
    await readJson(path.join(repositoryRoot, 'config/standings-identities.json')),
  );
  const outputPaths: string[] = [];
  let totalBytes = 0;
  for (const input of inputPaths) {
    const inputPath = path.resolve(repositoryRoot, input);
    totalBytes += (await stat(inputPath)).size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('Proposal inputs exceed the 256 MiB batch limit.');
    }
    const report = materializeProposal({
      proposal: await readJson(inputPath),
      archive: archiveResult.data,
      sourceConfiguration,
      identityAliases: identityRegistry.aliases,
    });
    report.files = report.files.filter((draft) => {
      if (Object.hasOwn(files, draft.path)) {
        report.blocked.push({
          candidateId: draft.candidateId,
          reason: 'Archive filename already exists; submit corrections manually.',
        });
        return false;
      }
      return true;
    });
    const proposedFiles = Object.fromEntries(
      report.files.map((draft) => [
        draft.path,
        () => Promise.resolve(JSON.stringify(draft.record)),
      ]),
    );
    const validation = await createJsonScoreboardsRepository(
      { ...files, ...proposedFiles },
      'archive',
    ).load();
    if (validation.status === 'invalid' || validation.status === 'error') {
      throw new Error(`Draft dataset did not validate: ${JSON.stringify(validation.issues)}`);
    }
    const stagingRoot = path.join(repositoryRoot, '.standings-ingestion');
    const draftsRoot = path.join(stagingRoot, 'drafts');
    for (const directory of [stagingRoot, draftsRoot]) {
      await mkdir(directory, { recursive: true });
      if ((await realpath(directory)) !== directory) {
        throw new Error('Draft output directories must not be symbolic links.');
      }
    }
    const bundleDirectory = await mkdtemp(path.join(draftsRoot, 'run-'));
    for (const draft of report.files) {
      const output = path.join(bundleDirectory, draft.path);
      await writeJsonAtomically(path.dirname(output), path.basename(output), draft.record);
    }
    await writeJsonAtomically(bundleDirectory, 'report.json', {
      ...report,
      inputProposal: path.relative(repositoryRoot, inputPath),
    });
    outputPaths.push(bundleDirectory);
    console.log(`Archive drafts written: ${bundleDirectory}`);
    console.log(
      `Draft records: ${String(report.files.length)}; blocked: ${String(report.blocked.length)}; archive unchanged.`,
    );
  }
  return outputPaths;
};

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await materializeProposalFiles(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
