import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { formatIssue, formatIssues, formatLocation, issuesFromZodError } from './issues';

describe('validation issue formatting', () => {
  it('formats a nested path as a readable location', () => {
    expect(formatLocation(['standings', 3, 'results', 1, 'attempts'])).toBe(
      'standings[3].results[1].attempts',
    );
  });

  it('formats issues with and without a location', () => {
    expect(formatIssue({ file: 'data/schools.json', location: '', message: 'missing file' })).toBe(
      'data/schools.json: missing file',
    );

    expect(
      formatIssue({
        file: 'data/schools.json',
        location: 'schools[0].id',
        message: 'duplicate school id',
      }),
    ).toBe('data/schools.json schools[0].id: duplicate school id');
  });

  it('converts a zod error into file issues', () => {
    const schema = z.object({
      name: z.string(),
      place: z.number(),
    });

    const result = schema.safeParse({ name: 123, place: 'first' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesFromZodError('data/test.json', result.error)).toEqual([
        {
          file: 'data/test.json',
          location: 'name',
          message: 'Invalid input: expected string, received number',
        },
        {
          file: 'data/test.json',
          location: 'place',
          message: 'Invalid input: expected number, received string',
        },
      ]);
    }
  });

  it('groups issues by file for review output', () => {
    expect(
      formatIssues([
        { file: 'data/b.json', location: 'value', message: 'bad value' },
        { file: 'data/a.json', location: '', message: 'missing' },
        { file: 'data/b.json', location: '', message: 'broken' },
      ]),
    ).toBe('data/a.json\n  - missing\n\ndata/b.json\n  - bad value (value)\n  - broken');
  });
});
