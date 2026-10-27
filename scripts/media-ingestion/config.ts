import { z } from 'zod';

import { hashtagSchema, mediaIdSchema, postSourceSchema } from '@/features/media/model/schemas';

const platformsSchema = z
  .array(postSourceSchema)
  .min(1)
  .refine((platforms) => new Set(platforms).size === platforms.length, 'platforms must be unique');

const sourceSchema = z.discriminatedUnion('type', [
  z
    .strictObject({
      type: z.literal('feed'),
      feedId: z.number().int().positive(),
      platforms: platformsSchema.optional(),
      sourceIds: z.array(z.number().int().positive()).min(1).optional(),
    })
    .refine(
      ({ platforms, sourceIds }) => platforms === undefined || sourceIds === undefined,
      'feed filters must use either platforms or sourceIds, not both',
    ),
  z.strictObject({
    type: z.literal('hashtag'),
    platforms: platformsSchema,
    // Defaults to the hashtag stored in the event's archive record.
    hashtags: z
      .array(hashtagSchema)
      .min(1)
      .refine(
        (hashtags) =>
          new Set(hashtags.map((hashtag) => hashtag.toLowerCase())).size === hashtags.length,
        'hashtags must be unique',
      )
      .optional(),
  }),
]);

export const configSchema = z.strictObject({
  events: z
    .array(
      z
        .strictObject({
          eventId: mediaIdSchema,
          sources: z.array(sourceSchema).min(1),
          startingAt: z.iso.datetime({ offset: true }).optional(),
          endingAt: z.iso.datetime({ offset: true }).optional(),
          suppressedPermalinks: z.array(z.httpUrl()).default([]),
        })
        .refine(
          ({ startingAt, endingAt }) =>
            startingAt === undefined ||
            endingAt === undefined ||
            Date.parse(startingAt) <= Date.parse(endingAt),
          'startingAt must not be after endingAt',
        ),
    )
    .refine(
      (events) => new Set(events.map(({ eventId }) => eventId)).size === events.length,
      'event IDs must be unique',
    ),
  requestTimeoutMs: z.number().int().min(1).max(120_000).default(30_000),
  retries: z.number().int().min(0).max(5).default(2),
  maxPages: z.number().int().min(1).max(100).default(20),
  maxRequests: z.number().int().min(1).max(1000).default(100),
});

export type IngestionConfig = z.infer<typeof configSchema>;
export type EventConfig = IngestionConfig['events'][number];
export type SourceConfig = EventConfig['sources'][number];

export const parseJson = (contents: string, label: string): unknown => {
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error(`${label}: invalid JSON`);
  }
};

export const parseConfig = (contents: string): IngestionConfig => {
  const result = configSchema.safeParse(parseJson(contents, 'Ingestion configuration'));
  if (!result.success) {
    throw new Error(
      `Invalid ingestion configuration: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  return result.data;
};
