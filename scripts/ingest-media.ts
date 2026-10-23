import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { parseConfig } from './media-ingestion/config';
import { ingestMedia } from './media-ingestion/ingestion';

const run = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', default: 'config/media-ingestion.json' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const root = fileURLToPath(new URL('..', import.meta.url));
  const config = parseConfig(await readFile(path.resolve(root, values.config), 'utf8'));
  const summaries = await ingestMedia({
    root,
    config,
    apiKey: process.env.JUICER_API_KEY ?? '',
    dryRun: values['dry-run'],
  });
  console.log(values['dry-run'] ? 'Dry run: archive unchanged.' : 'Media ingestion complete.');
  for (const summary of summaries) {
    console.log(JSON.stringify(summary));
  }
};

try {
  await run();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown ingestion failure';
  const apiKey = process.env.JUICER_API_KEY;
  console.error(apiKey ? message.replaceAll(apiKey, '[REDACTED]') : message);
  process.exitCode = 1;
}
