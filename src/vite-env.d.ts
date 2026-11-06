interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
}

declare module 'virtual:scoreboards-catalog' {
  import type { ScoreboardsCatalog } from '@/features/scoreboards/model/schemas';

  export const scoreboardsCatalog: ScoreboardsCatalog;
}
