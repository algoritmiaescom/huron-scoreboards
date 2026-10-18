import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { formatIssues } from '@/lib/validation/issues';

import { validateDataDirectory } from './data-validation';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Datasets are validated independently so that mock records can never satisfy a reference in the
 * real archive. `data/mock` holds seed data; `data` holds transcribed results.
 */
const datasetDirectories = [
  path.join(repositoryRoot, 'data'),
  path.join(repositoryRoot, 'data', 'mock'),
];

const run = async (): Promise<void> => {
  const reports = await Promise.all(
    datasetDirectories.map(async (directory) => validateDataDirectory(repositoryRoot, directory)),
  );

  const issues = reports.flatMap((report) => report.issues);
  const fileCount = reports.reduce((total, report) => total + report.fileCount, 0);

  if (issues.length > 0) {
    console.error(formatIssues(issues));
    console.error(
      `\n${String(issues.length)} problem(s) found in ${String(fileCount)} data file(s).`,
    );
    process.exitCode = 1;
    return;
  }

  if (fileCount === 0) {
    console.log('No data files found under data/. Nothing to validate yet.');
    return;
  }

  console.log(`Validated ${String(fileCount)} data file(s). No problems found.`);
};

await run();
