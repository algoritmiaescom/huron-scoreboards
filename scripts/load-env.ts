import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Variables already in the environment, such as CI secrets, take precedence over `.env`.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}
