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

const EventPicker = styled('label')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(0.75),
  minWidth: 0,
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
}));

const EventSelect = styled('select')(({ theme }) => ({
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
    selectedContest,
    eventsWithMedia,
    defaultEventId,
    selectionError,
    feed,
  } = useLoaderData<MediaPageData>();
  const [, setSearchParams] = useSearchParams();
  const selectedEvent = feed.status === 'found' ? feed.record.event : undefined;
  const eventOptions = [
    ...eventsWithMedia.map(({ record }) => record.event),
    ...(selectedEvent !== undefined &&
    !eventsWithMedia.some(({ record }) => record.event.id === selectedEvent.id)
      ? [selectedEvent]
      : []),
  ].toSorted((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const showEventPicker = eventOptions.length > 1 || selectionError !== undefined;
  const subtitle =
    selectedEvent !== undefined
      ? `${selectedEvent.name} · ${formatCalendarDate(selectedEvent.date)}${selectedEvent.location === undefined ? '' : ` · ${selectedEvent.location}`}`
      : selectedContest === undefined
        ? 'Publicaciones de eventos de la comunidad.'
        : `${selectedContest.name} · ${formatCalendarDate(selectedContest.date)}`;

  return (
    <>
      <DocumentTitle>Comunidad</DocumentTitle>
      <Hero
        eyebrow={`Publicaciones archivadas · ${selectedEvent?.name ?? selectedContest?.name ?? 'comunidad'}`}
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
            message="El feed requiere validar las referencias a las competencias archivadas."
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
              {showEventPicker && (
                <EventPicker htmlFor="media-event">
                  Ver publicaciones de otro evento
                  <EventSelect
                    id="media-event"
                    value={selectedEvent?.id ?? ''}
                    onChange={(event) => {
                      const eventId = event.currentTarget.value;
                      setSearchParams((current) => {
                        const next = new URLSearchParams(current);
                        next.delete('contest');
                        if (eventId === defaultEventId || eventId === '') {
                          next.delete('event');
                        } else {
                          next.set('event', eventId);
                        }
                        return next;
                      });
                    }}
                  >
                    {selectedEvent === undefined && (
                      <option value="">Selecciona un evento archivado</option>
                    )}
                    {eventOptions.map((event) => {
                      const hasMedia = eventsWithMedia.some(
                        ({ record }) => record.event.id === event.id,
                      );
                      return (
                        <option key={event.id} value={event.id}>
                          {event.name} · {formatCalendarDate(event.date)}
                          {hasMedia ? '' : ' · sin publicaciones archivadas'}
                        </option>
                      );
                    })}
                  </EventSelect>
                </EventPicker>
              )}
            </FeedHeader>

            {selectionError !== undefined ? (
              <Alert severity="warning">
                {selectionError === 'repeated'
                  ? 'La selección de evento o competencia aparece más de una vez en la dirección.'
                  : 'El evento o la competencia seleccionada no existe en el archivo.'}{' '}
                Elige un evento archivado para continuar.
              </Alert>
            ) : feed.status === 'found' && feed.record.posts.length > 0 ? (
              <ListGrid
                columns={{ md: 2, lg: 3 }}
                aria-label={`Publicaciones de ${selectedEvent?.name ?? 'el evento seleccionado'}`}
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
                    {feed.status === 'found'
                      ? `El evento ${feed.record.event.name} no tiene publicaciones vinculadas ya publicadas.`
                      : selectedContest === undefined
                        ? 'No hay eventos con publicaciones disponibles en el archivo.'
                        : `No hay un evento archivado para ${selectedContest.name}.`}
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
