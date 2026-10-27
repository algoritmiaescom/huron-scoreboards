import Code from '@mui/icons-material/Code';
import GitHub from '@mui/icons-material/GitHub';
import Launch from '@mui/icons-material/Launch';
import { Alert, Button, Divider, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { DocumentTitle } from '@/app/components/DocumentTitle';
import { appConfig, repositoryLinks } from '@/app/config';
import { PageContainer } from '@/components';
import { ContributionSteps, DataRequirements, EvidenceRequirements } from '@/features/contribution';

const Page = styled(PageContainer)(({ theme }) => ({
  paddingBlock: theme.spacing(5),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(8) },
}));

const Intro = styled('div')(({ theme }) => ({
  maxWidth: theme.spacing(100),
}));

const Heading = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  fontSize: theme.typography.pxToRem(44.8),
  [theme.breakpoints.up('md')]: { fontSize: theme.typography.pxToRem(80) },
}));

const Lead = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(3),
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
  <Page maxWidth="lg">
    <DocumentTitle>Contribuir</DocumentTitle>
    <Intro>
      <Typography variant="overline" color="primary">
        Datos públicos, revisión pública
      </Typography>
      <Heading variant="h1">¿Encontraste un error? Corrígelo desde la fuente.</Heading>
      <Lead color="text.secondary">
        Huron Scoreboards es de solo lectura. Las correcciones se realizan mediante archivos JSON
        versionados y pull requests revisados en el repositorio de GitHub.
      </Lead>
      <RepositoryAction
        href={repositoryLinks.home}
        variant="contained"
        size="large"
        startIcon={<GitHub />}
        endIcon={<Launch />}
      >
        {appConfig.repository.isPlaceholder
          ? 'GitHub: enlace provisional'
          : 'Abrir el repositorio de GitHub'}
      </RepositoryAction>
    </Intro>
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
    <Alert severity="info" icon={<Code />}>
      Esta aplicación no tiene cuentas, pantallas de administración ni formularios de edición. El
      historial de Git es el registro de auditoría de cada corrección.
    </Alert>
  </Page>
);
