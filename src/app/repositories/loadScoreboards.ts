import { loadApplicationRepositories } from './applicationData';

export const loadScoreboards = async () => {
  const repositories = await loadApplicationRepositories();
  const result = await repositories.scoreboards.load();
  if (result.status === 'invalid' || result.status === 'error') {
    console.error('Could not load scoreboard archive.', result.issues);
  }
  return result;
};
