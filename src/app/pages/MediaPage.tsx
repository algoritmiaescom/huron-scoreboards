import Launch from '@mui/icons-material/Launch';
import Tag from '@mui/icons-material/Tag';
import { Alert, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link, useLoaderData, useSearchParams } from 'react-router';

import { DocumentTitle } from '@/app/components/DocumentTitle';
import { DataLoadError, HeroBanner, ListGrid, PageContainer, SectionTitle } from '@/components';
import { MediaPostCard } from '@/features/media/components/MediaPostCard';
import { formatCalendarDate } from '@/lib/dates';

import type { MediaPageData } from '@/app/repositories/loadMediaPage';

const Hero = styled(HeroBanner)(({ theme }) => ({
  '&::after': {
    content: '""',
    position: 'absolute',
    width: 420,
    height: 420,
    border: `60px solid ${theme.palette.brand.yellow}`,
    borderRadius: '50%',
    right: -80,
    top: -190,
    opacity: 0.12,
  },
  '& [data-hero-title]': {
    maxWidth: '16ch',
    [theme.breakpoints.down('sm')]: { fontSize: '2.6rem' },
    [theme.breakpoints.up('md')]: { fontSize: '5rem' },
  },
}));
const Hashtag = styled(Chip)(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

const FeedSection = styled('section')(({ theme }) => ({
  paddingBlock: theme.spacing(5),
}));

const FeedHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
}));

const ContestPicker = styled('label')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(0.75),
  minWidth: 0,
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
}));

const ContestSelect = styled('select')(({ theme }) => ({
  width: '100%',
  minHeight: theme.spacing(5.25),
  padding: theme.spacing(1, 1.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  font: 'inherit',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

const EmptyCard = styled(Card)(({ theme }) => ({
  paddingBlock: theme.spacing(7),
  textAlign: 'center',
}));

const EmptyContent = styled(CardContent)(({ theme }) => ({
  display: 'grid',
  justifyItems: 'center',
  gap: theme.spacing(2),
}));

const SourceNote = styled(Alert)(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

export const MediaPage = () => {
  const {
    scoreboards,
    media,
    latestContest,
    selectedContest,
    contestsWithMedia,
    selectionError,
    feed,
  } = useLoaderData<MediaPageData>();
  const [, setSearchParams] = useSearchParams();
  const fallbackContests = [latestContest, selectedContest].flatMap((contest, index, choices) =>
    contest !== undefined &&
    !contestsWithMedia.some((option) => option.contest.id === contest.id) &&
    choices.findIndex((choice) => choice?.id === contest.id) === index
      ? [contest]
      : [],
  );
  const contestOptions = [
    ...contestsWithMedia.map(({ contest }) => contest),
    ...fallbackContests,
  ].toSorted((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id));
  const showContestPicker = contestOptions.length > 1;
  const selectedEvent = feed.status === 'found' ? feed.record.event : undefined;
  const subtitle =
    selectedEvent !== undefined
      ? `${selectedEvent.name} · ${formatCalendarDate(selectedEvent.date)}${selectedEvent.location === undefined ? '' : ` · ${selectedEvent.location}`}`
      : selectedContest === undefined
        ? 'Aún no hay concursos realizados en el archivo.'
        : `${selectedContest.name} · ${formatCalendarDate(selectedContest.date)}`;

  return (
    <>
      <DocumentTitle>Comunidad</DocumentTitle>
      <Hero
        eyebrow={`Publicaciones archivadas · ${selectedContest?.name ?? 'competencia'}`}
        title="Más allá de la clasificación."
        description={subtitle}
      >
        {selectedEvent !== undefined && (
          <Hashtag icon={<Tag />} label={selectedEvent.hashtag} color="secondary" />
        )}
      </Hero>

      <PageContainer maxWidth="xl">
        {scoreboards.status === 'invalid' || scoreboards.status === 'error' ? (
          <DataLoadError
            title="No se pudo cargar el archivo de competencias"
            message="El feed requiere validar las competencias archivadas antes de elegir el evento más reciente."
            issues={scoreboards.issues}
          />
        ) : media.status === 'blocked' ? (
          <Alert severity="error">El archivo de publicaciones quedó bloqueado.</Alert>
        ) : media.status === 'invalid' || media.status === 'error' ? (
          <DataLoadError
            title="No se pudo cargar el archivo de publicaciones"
            message="El contenido archivado no superó la validación."
            issues={media.issues}
          />
        ) : (
          <FeedSection aria-labelledby="media-feed-heading">
            <FeedHeader>
              <div>
                <SectionTitle
                  id="media-feed-heading"
                  eyebrow="Publicaciones sociales"
                  title="Desde la comunidad"
                  variant="h4"
                />
              </div>
              <Typography variant="body2" color="text.secondary">
                Fuentes: X · Instagram · Facebook · YouTube · LinkedIn
              </Typography>
              {showContestPicker && (
                <ContestPicker htmlFor="media-contest">
                  Ver publicaciones de otra competencia
                  <ContestSelect
                    id="media-contest"
                    value={selectedContest?.id ?? ''}
                    onChange={(event) => {
                      const contestId = event.currentTarget.value;
                      setSearchParams((current) => {
                        const next = new URLSearchParams(current);
                        if (contestId === latestContest?.id || contestId === '') {
                          next.delete('contest');
                        } else {
                          next.set('contest', contestId);
                        }
                        return next;
                      });
                    }}
                  >
                    {selectionError !== undefined && (
                      <option value="">Selecciona una competencia archivada</option>
                    )}
                    {contestOptions.map((contest) => {
                      const hasMedia = contestsWithMedia.some(
                        (option) => option.contest.id === contest.id,
                      );
                      return (
                        <option key={contest.id} value={contest.id}>
                          {contest.name} · {formatCalendarDate(contest.date)}
                          {hasMedia ? '' : ' · sin publicaciones archivadas'}
                        </option>
                      );
                    })}
                  </ContestSelect>
                </ContestPicker>
              )}
            </FeedHeader>

            {selectionError !== undefined ? (
              <Alert severity="warning">
                {selectionError === 'repeated'
                  ? 'La selección de competencia aparece más de una vez en la dirección.'
                  : 'La competencia seleccionada no existe en el archivo o aún no se ha realizado.'}{' '}
                Elige una competencia archivada para continuar.
              </Alert>
            ) : feed.status === 'found' && feed.record.posts.length > 0 ? (
              <ListGrid
                columns={{ md: 2, lg: 3 }}
                aria-label={`Publicaciones de ${selectedContest?.name ?? 'la competencia seleccionada'}`}
              >
                {feed.record.posts.map((post) => (
                  <li key={post.id}>
                    <MediaPostCard post={post} />
                  </li>
                ))}
              </ListGrid>
            ) : (
              <EmptyCard>
                <EmptyContent>
                  <Tag color="disabled" fontSize="large" />
                  <Typography component="h3" variant="h5">
                    Aún no hay publicaciones archivadas
                  </Typography>
                  <Typography color="text.secondary">
                    {selectedContest === undefined
                      ? 'No hay concursos realizados en el archivo para seleccionar un evento.'
                      : feed.status === 'found'
                        ? `El evento ${feed.record.event.name} no tiene publicaciones vinculadas.`
                        : `No hay un evento archivado para ${selectedContest.name}. No se sustituyen publicaciones de otras competencias ni de eventos futuros.`}
                  </Typography>
                  {selectedContest !== undefined && (
                    <Button
                      component={Link}
                      to={`/scoreboards?contest=${encodeURIComponent(selectedContest.id)}`}
                      variant="outlined"
                      endIcon={<Launch />}
                    >
                      Ver clasificación de {selectedContest.name}
                    </Button>
                  )}
                </EmptyContent>
              </EmptyCard>
            )}

            <SourceNote severity="info">
              Este feed muestra publicaciones seleccionadas y versionadas en el archivo del
              proyecto; no consulta redes sociales en vivo. Cada recurso multimedia requiere texto
              alternativo y cada tarjeta enlaza a la publicación original.
            </SourceNote>
          </FeedSection>
        )}
      </PageContainer>
    </>
  );
};
