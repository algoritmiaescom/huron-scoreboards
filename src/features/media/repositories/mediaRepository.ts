import { type MediaDataset, validateMediaReferences } from '@/features/media/model/dataset';
import { type EventFile, eventFileSchema } from '@/features/media/model/schemas';
import {
  type DatasetSource,
  type JsonFiles,
  loadJsonFile,
  relativeDataPath,
  type RepositoryResult,
} from '@/lib/data/repository';

import type { ValidationIssue } from '@/lib/validation/issues';

export interface MediaArchive {
  source: DatasetSource;
  events: EventFile[];
}

export interface MediaRepository {
  load: (contestIds: ReadonlySet<string>) => Promise<RepositoryResult<MediaArchive>>;
}

export const createJsonMediaRepository = (
  files: JsonFiles,
  source: DatasetSource,
): MediaRepository => ({
  load: async (contestIds) => {
    const dataset: MediaDataset = { events: [] };
    const issues: ValidationIssue[] = [];
    const failures: ('invalid' | 'error')[] = [];
    await Promise.all(
      Object.entries(files).map(async ([file, load]) => {
        const relative = relativeDataPath(file, source);
        if (!relative?.startsWith('media/')) {
          return;
        }
        if (!/^media\/events\/[^/]+\.json$/.test(relative)) {
          issues.push({ file, location: '', message: 'unrecognized media data path' });
          return;
        }
        const result = await loadJsonFile(file, load, eventFileSchema);
        if (result.status === 'error' || result.status === 'invalid') {
          issues.push(...result.issues);
          failures.push(result.status);
        } else {
          dataset.events.push({ file, record: result.data });
        }
      }),
    );
    issues.push(...validateMediaReferences(dataset, contestIds));
    if (issues.length > 0) {
      return { status: failures.includes('error') ? 'error' : 'invalid', issues };
    }
    const events = dataset.events
      .map(({ record }) => record)
      .sort((a, b) => a.event.id.localeCompare(b.event.id));
    return { status: events.length === 0 ? 'empty' : 'ready', data: { source, events } };
  },
});
