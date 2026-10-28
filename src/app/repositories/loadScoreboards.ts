import { loadApplicationRepositories } from './applicationData';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

let archiveResult: Promise<RepositoryResult<ScoreboardsArchive>> | undefined;

export const loadScoreboards = () => {
  if (archiveResult === undefined) {
    const pending = (async () => {
      const repositories = await loadApplicationRepositories();
      const result = await repositories.scoreboards.load();
      if (result.status === 'invalid' || result.status === 'error') {
        console.error('Could not load scoreboard archive.', result.issues);
      }
      return result;
    })();
    archiveResult = pending.catch((error: unknown) => {
      archiveResult = undefined;
      throw error;
    });
  }
  return archiveResult;
};
