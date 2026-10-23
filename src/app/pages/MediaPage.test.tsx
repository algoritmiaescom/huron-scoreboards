import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppShell } from '@/app/components/AppShell';
import { MediaPage } from '@/app/pages/MediaPage';
import { archive, eventFile } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

import { selectMediaPageData } from '../repositories/loadMediaPage';

import type { MediaPageData } from '@/app/repositories/loadMediaPage';
import type { MediaArchive } from '@/features/media';
import type { Post } from '@/features/media';
import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

const createPageData = (
  posts: Post[],
  scoreboards: RepositoryResult<ScoreboardsArchive> = { status: 'ready', data: archive },
  media: RepositoryResult<MediaArchive> = {
    status: 'ready',
    data: {
      source: 'mock',
      events: [
        {
          ...eventFile,
          event: { ...eventFile.event, postIds: posts.map(({ id }) => id) },
          posts,
        },
      ],
    },
  },
): MediaPageData => selectMediaPageData(scoreboards, media, new Date('2024-03-02T12:00:00Z'));

const renderMedia = (data: MediaPageData, initialEntry = '/media') => {
  const router = createMemoryRouter(
    [
      {
        Component: AppShell,
        children: [
          {
            path: '/media',
            loader: ({ request }) => {
              const contests = new URL(request.url).searchParams.getAll('contest');
              return selectMediaPageData(
                data.scoreboards,
                data.media,
                new Date('2024-03-02T12:00:00Z'),
                contests.length === 1 ? contests[0] : undefined,
                contests.length > 1,
              );
            },
            Component: MediaPage,
          },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );
  renderApp(<RouterProvider router={router} />);
  return router;
};

describe('media page', () => {
  it('renders archived posts, optional metadata, tags and original permalinks', async () => {
    const post: Post = {
      ...eventFile.posts[0],
      id: 'community-post',
      title: 'Una publicación desde la comunidad',
      media: [{ type: 'image', url: 'https://example.com/photo.jpg', alt: 'Equipo en concurso' }],
      tags: ['#GPM2024', '#ICPC'],
      author: {
        username: 'club',
        displayName: 'Club de algoritmia',
        profileUrl: 'https://example.com/club',
      },
    };
    renderMedia(createPageData([post]));

    expect(
      await screen.findByRole('heading', { name: 'Más allá de la clasificación.' }),
    ).toBeVisible();
    expect(screen.getByText(/Event ·/)).toBeVisible();
    expect(screen.getByRole('img', { name: 'Equipo en concurso' })).toHaveAttribute(
      'src',
      'https://example.com/photo.jpg',
    );
    expect(screen.getByRole('link', { name: 'Club de algoritmia' })).toHaveAttribute(
      'href',
      'https://example.com/club',
    );
    expect(screen.getByText('Una publicación desde la comunidad')).toBeVisible();
    expect(screen.getAllByText('#GPM2024')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Ver publicación original' })).toHaveAttribute(
      'href',
      post.permalink,
    );
    expect(screen.getByText(/no consulta redes sociales en vivo/)).toBeVisible();
    expect(document.title).toBe('Comunidad | Huron Scoreboards');
  });

  it('cycles an accessible carousel in both directions and recovers failed image loads', async () => {
    const user = userEvent.setup();
    const post: Post = {
      ...eventFile.posts[0],
      id: 'carousel-post',
      media: [
        { type: 'image', url: 'https://example.com/first.jpg', alt: 'Primer recurso' },
        { type: 'image', url: 'https://example.com/second.jpg', alt: 'Segundo recurso' },
      ],
    };
    renderMedia(createPageData([post]));
    const carousel = await screen.findByRole('article');
    expect(within(carousel).getByText('1 / 2')).toBeVisible();
    await user.click(within(carousel).getByRole('button', { name: /Recurso siguiente/ }));
    expect(within(carousel).getByText('2 / 2')).toBeVisible();
    expect(within(carousel).getByRole('img', { name: 'Segundo recurso' })).toBeVisible();
    await user.click(within(carousel).getByRole('button', { name: /Recurso anterior/ }));
    expect(within(carousel).getByText('1 / 2')).toBeVisible();
    const image = within(carousel).getByRole('img', { name: 'Primer recurso' });
    image.dispatchEvent(new Event('error'));
    expect(await within(carousel).findByRole('status')).toHaveTextContent(
      'No se pudo cargar la imagen',
    );
    expect(
      within(carousel).getByRole('link', { name: 'Ver publicación original' }),
    ).toHaveAttribute('href', post.permalink);
  });

  it('uses native video controls with a persistent original-post link', async () => {
    const post: Post = {
      ...eventFile.posts[0],
      id: 'video-post',
      media: [
        { type: 'video', url: 'https://example.com/clip.mp4', alt: 'Celebración del equipo' },
      ],
    };
    renderMedia(createPageData([post]));
    const video = await screen.findByLabelText('Celebración del equipo');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('controls');
    expect(screen.getByRole('link', { name: 'Ver publicación original' })).toHaveAttribute(
      'href',
      post.permalink,
    );
  });

  it('distinguishes no event, an event with no posts, and media repository errors', async () => {
    const empty = createPageData(
      [],
      { status: 'ready', data: archive },
      {
        status: 'ready',
        data: {
          source: 'mock',
          events: [{ ...eventFile, event: { ...eventFile.event, postIds: [] }, posts: [] }],
        },
      },
    );
    renderMedia(empty);
    expect(await screen.findByText(/no tiene publicaciones vinculadas/)).toBeVisible();
    expect(screen.getByRole('link', { name: /Ver clasificación de/ })).toHaveAttribute(
      'href',
      '/scoreboards?contest=2024-gpm-q1',
    );
  });

  it('shows validated repository diagnostics instead of inventing a live-service outage', async () => {
    const error = createPageData(
      [],
      { status: 'ready', data: archive },
      {
        status: 'invalid',
        issues: [
          { file: 'media/events/bad.json', location: 'posts[0]', message: 'invalid alt text' },
        ],
      },
    );
    renderMedia(error);
    expect(
      await screen.findByRole('heading', { name: 'No se pudo cargar el archivo de publicaciones' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('media/events/bad.json');
    expect(screen.queryByText(/fuente en vivo|API/)).not.toBeInTheDocument();
  });

  it('lets visitors browse previous competitions with archived posts and preserves selection in the URL', async () => {
    const user = userEvent.setup();
    const previousContest = {
      ...archive.contests[0],
      id: '2023-gpm-q1',
      seasonYear: 2023,
      date: '2023-03-01',
      name: 'GPM 2023',
    };
    const previousPost: Post = {
      ...eventFile.posts[0],
      id: 'previous-post',
      body: 'Archivo de una competencia anterior',
    };
    const previousEvent = {
      ...eventFile,
      event: {
        ...eventFile.event,
        id: '2023-gpm-event',
        contestId: previousContest.id,
        date: '2023-03-01',
        postIds: [previousPost.id],
      },
      posts: [previousPost],
    };
    const data = selectMediaPageData(
      { status: 'ready', data: { ...archive, contests: [archive.contests[0], previousContest] } },
      {
        status: 'ready',
        data: {
          source: 'mock',
          events: [
            {
              ...eventFile,
              event: { ...eventFile.event, postIds: ['post-a'] },
              posts: eventFile.posts.filter(({ id }) => id === 'post-a'),
            },
            previousEvent,
          ],
        },
      },
      new Date('2024-03-02T12:00:00Z'),
    );
    const router = renderMedia(data);

    expect(await screen.findByText('post-a')).toBeVisible();
    const picker = screen.getByLabelText('Ver publicaciones de otra competencia');
    expect(picker).toHaveValue('2024-gpm-q1');
    await user.selectOptions(picker, '2023-gpm-q1');

    expect(await screen.findByText('Archivo de una competencia anterior')).toBeVisible();
    expect(screen.queryByText('post-a')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?contest=2023-gpm-q1');
    expect(screen.getAllByText(/GPM 2023/)).toHaveLength(2);
  });

  it('explains unknown contest selections instead of showing another contest', async () => {
    const post = eventFile.posts[0];
    const data = createPageData([post]);

    renderMedia(data, '/media?contest=missing');
    expect(await screen.findByText(/no existe en el archivo/)).toBeVisible();
    expect(screen.queryByText(post.body)).not.toBeInTheDocument();
  });

  it('explains repeated contest selections', async () => {
    const data = createPageData([eventFile.posts[0]]);

    renderMedia(data, '/media?contest=2024-gpm-q1&contest=2024-gpm-q1');
    expect(await screen.findByText(/aparece más de una vez/)).toBeVisible();
    expect(screen.queryByText(eventFile.posts[0].body)).not.toBeInTheDocument();
  });
});
