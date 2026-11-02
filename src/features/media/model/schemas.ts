import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const mediaIdSchema = z
  .string()
  .regex(SLUG_PATTERN, 'must be a lowercase slug such as `2024-mexico-finals`');

export const postSourceSchema = z.enum(['x', 'instagram', 'facebook', 'youtube', 'linkedin']);

export const postAuthorSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1).optional(),
  avatarUrl: z.url().optional(),
  profileUrl: z.url().optional(),
});

export const postMediaSchema = z.object({
  type: z.enum(['image', 'video']),
  url: z.url(),
  // An empty string means a description is unavailable, not that the media is decorative.
  alt: z.string(),
});

export const postSchema = z
  .object({
    id: mediaIdSchema,
    source: postSourceSchema,
    author: postAuthorSchema,
    postedAt: z.iso.datetime({ offset: true }),
    title: z.string().min(1).optional(),
    body: z.string(),
    media: z.array(postMediaSchema),
    permalink: z.url(),
    tags: z.array(z.string().min(1)),
  })
  .refine((post) => post.body.trim().length > 0 || post.media.length > 0, {
    path: ['body'],
    message: 'must contain text or image/video media',
  });

export const hashtagSchema = z.string().regex(/^#[\w]+$/, 'must be a hashtag such as `#GPM2024`');

export const eventSchema = z.object({
  id: mediaIdSchema,
  name: z.string().min(1),
  date: z.iso.date(),
  hashtag: hashtagSchema,
  location: z.string().min(1).optional(),
  // Loose reference: the media feature must not import scoreboards types.
  contestId: z.string().min(1).optional(),
  postIds: z.array(mediaIdSchema),
});

export const eventFileSchema = z.object({
  event: eventSchema,
  posts: z.array(postSchema),
});

export type PostSource = z.infer<typeof postSourceSchema>;
export type PostAuthor = z.infer<typeof postAuthorSchema>;
export type PostMedia = z.infer<typeof postMediaSchema>;
export type Post = z.infer<typeof postSchema>;
export type Event = z.infer<typeof eventSchema>;
export type EventFile = z.infer<typeof eventFileSchema>;
