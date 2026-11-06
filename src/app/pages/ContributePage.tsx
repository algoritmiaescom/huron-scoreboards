import GitHub from '@mui/icons-material/GitHub';
import Launch from '@mui/icons-material/Launch';
import { Alert, Button, Divider, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';

import { DocumentTitle } from '@/app/components/DocumentTitle';
import { appConfig, repositoryLinks } from '@/app/config';
import { HeroBanner, PageContainer } from '@/components';
import { ContributionSteps, DataRequirements, EvidenceRequirements } from '@/features/contribution';

const Page = styled(PageContainer)(({ theme }) => ({
  paddingBlock: theme.spacing(5),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(8) },
}));

const Hero = styled(HeroBanner)(({ theme }) => ({
  '& [data-hero-title]': {
    maxWidth: theme.spacing(100),
    fontSize: theme.typography.pxToRem(44.8),
    [theme.breakpoints.up('md')]: { fontSize: theme.typography.pxToRem(80) },
  },
}));

const Lead = styled('span')(({ theme }) => ({
  display: 'block',
  maxWidth: theme.spacing(90),
  fontSize: theme.typography.pxToRem(17.6),
  lineHeight: 1.75,
}));

const RepositoryAction = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(4),
  maxWidth: '100%',
}));

const Workflow = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(3),
  marginBlock: theme.spacing(7, 3),
  alignItems: 'start',
  [theme.breakpoints.up('md')]: { gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' },
}));

const Resources = styled(Stack)(({ theme }) => ({
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginBlock: theme.spacing(3),
}));

const SectionDivider = styled(Divider)(({ theme }) => ({ marginBlock: theme.spacing(6) }));

export const ContributePage = () => (
  <>
    <DocumentTitle>Contribuir</DocumentTitle>
    <Hero
      maxWidth="lg"
      eyebrow="Datos públicos, revisión pública"
      title="¿Encontraste un error? Corrígelo desde la fuente."
      description={
        <Lead>
          Huron Scoreboards es de solo lectura. Las correcciones se realizan mediante archivos JSON
          versionados y pull requests revisados en el repositorio de GitHub.
        </Lead>
      }
    >
      <RepositoryAction
        href={repositoryLinks.home}
        variant="contained"
        color="secondary"
        size="large"
        startIcon={<GitHub />}
        endIcon={<Launch />}
      >
        {appConfig.repository.isPlaceholder
          ? 'GitHub: enlace provisional'
          : 'Abrir el repositorio de GitHub'}
      </RepositoryAction>
    </Hero>
    <Page maxWidth="lg">
      {appConfig.repository.isPlaceholder && (
        <Resources>
          <Alert severity="info">
            El repositorio de GitHub aún no está configurado. Los enlaces de esta guía son
            provisionales y no permiten enviar una corrección al proyecto todavía.
          </Alert>
        </Resources>
      )}
      <Workflow>
        <ContributionSteps />
        <EvidenceRequirements />
      </Workflow>
      <DataRequirements />
      <Resources direction="row" aria-label="Recursos de contribución">
        <Button component="a" href={repositoryLinks.data}>
          Explorar archivos JSON
        </Button>
        <Button component="a" href={repositoryLinks.contributing}>
          Guía de contribución
        </Button>
        <Button component="a" href={repositoryLinks.dataModel}>
          Modelo de datos
        </Button>
        <Button component="a" href={repositoryLinks.pullRequests}>
          Pull requests
        </Button>
      </Resources>
      <SectionDivider />
    </Page>
  </>
);
