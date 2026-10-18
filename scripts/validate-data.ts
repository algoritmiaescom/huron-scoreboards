import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { formatIssues } from '@/lib/validation/issues';

import { validateDataDirectory } from './data-validation';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

const run = async (): Promise<void> => {
  const { issues, fileCount } = await validateDataDirectory(repositoryRoot);

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
