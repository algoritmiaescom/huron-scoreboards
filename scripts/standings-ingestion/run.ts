import process from 'node:process';

import { runStandingsIngestion } from './cli';

try {
  const result = await runStandingsIngestion(process.argv.slice(2));
  console.log(`Review proposal written: ${result.proposalPath}`);
  console.log(`Run status: ${result.status}; archive unchanged.`);
  if (result.status === 'failed') {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unknown standings ingestion failure');
  process.exitCode = 1;
}
