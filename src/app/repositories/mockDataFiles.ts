export const mockDataFiles = import.meta.glob<string>('/data/mock/**/*.json', {
  query: '?raw',
  import: 'default',
});
