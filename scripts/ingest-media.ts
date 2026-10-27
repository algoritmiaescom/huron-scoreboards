import './load-env';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { parseConfig } from './media-ingestion/config';
import { ingestMedia } from './media-ingestion/ingestion';

const redact = (message: string): string => {
  const apiKey = process.env.JUICER_API_KEY;
  return apiKey ? message.replaceAll(apiKey, '[REDACTED]') : message;
};

const run = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', default: 'config/media-ingestion.json' },
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
    },
  });
  const root = fileURLToPath(new URL('..', import.meta.url));
  const config = parseConfig(await readFile(path.resolve(root, values.config), 'utf8'));
  const summaries = await ingestMedia({
    root,
    config,
    apiKey: process.env.JUICER_API_KEY ?? '',
    dryRun: values['dry-run'],
    dependencies: values.verbose
      ? {
          log: (line) => {
            console.error(line);
          },
        }
      : undefined,
    onWarning: (warning) => {
      // GitHub Actions turns `::warning::` lines into run annotations.
      const prefix = process.env.GITHUB_ACTIONS === 'true' ? '::warning::' : 'Warning: ';
      console.error(`${prefix}${redact(warning)}`);
    },
  });
  console.log(values['dry-run'] ? 'Dry run: archive unchanged.' : 'Media ingestion complete.');
  for (const summary of summaries) {
    console.log(JSON.stringify(summary));
  }
};

try {
  await run();
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : 'Unknown ingestion failure'));
  process.exitCode = 1;
}
