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
  // Required: alt text cannot be derived from the post, so a contributor must supply it.
  alt: z.string().min(1, 'alt text is required for every image and video'),
});

export const postSchema = z.object({
  id: mediaIdSchema,
  source: postSourceSchema,
  author: postAuthorSchema,
  postedAt: z.iso.datetime({ offset: true }),
  title: z.string().min(1).optional(),
  body: z.string().min(1),
  media: z.array(postMediaSchema),
  permalink: z.url(),
  tags: z.array(z.string().min(1)),
});

export const eventSchema = z.object({
  id: mediaIdSchema,
  name: z.string().min(1),
  date: z.iso.date(),
  hashtag: z.string().regex(/^#[\w]+$/, 'must be a hashtag such as `#GPM2024`'),
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
