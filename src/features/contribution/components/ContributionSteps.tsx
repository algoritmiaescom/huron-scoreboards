import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { GuideSection } from './GuideSection';

const steps = [
  {
    title: 'Encuentra el JSON versionado',
    description:
      'Localiza la temporada, la serie y la etapa del concurso en data/seasons/. Las escuelas viven en data/schools.json y cada temporada tiene su propio teams.json.',
  },
  {
    title: 'Edita solo lo respaldado por evidencia',
    description:
      'Haz un cambio acotado, conserva los identificadores y el orden de los problemas. Un equipo es un registro de una temporada; no conectes su identidad entre años.',
  },
  {
    title: 'Incluye la fuente oficial',
    description:
      'Enlaza la clasificación oficial en source y explica qué registro cambia y qué demuestra la evidencia.',
  },
  {
    title: 'Valida y abre un pull request',
    description:
      'Crea una rama desde main. Con Node 24 y npm 11, instala con npm ci y ejecuta npm run validate:data y npm run validate. Describe el cambio en un pull request y espera la revisión y los checks de CI.',
  },
];

const Steps = styled('ol')(({ theme }) => ({
  listStyle: 'none',
  counterReset: 'contribution-step',
  margin: 0,
  padding: 0,
  '& > li': {
    counterIncrement: 'contribution-step',
    display: 'grid',
    gridTemplateColumns: `${theme.spacing(4)} minmax(0, 1fr)`,
    gap: theme.spacing(2),
    paddingBlock: theme.spacing(2.5),
    '&:not(:last-child)': { borderBottom: `1px solid ${theme.palette.divider}` },
    '&::before': {
      content: 'counter(contribution-step)',
      display: 'grid',
      placeItems: 'center',
      width: theme.spacing(4),
      height: theme.spacing(4),
      borderRadius: '50%',
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      fontFamily: theme.typography.data.fontFamily,
      fontWeight: theme.typography.fontWeightBold,
    },
  },
}));

const Description = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  lineHeight: 1.65,
}));

export const ContributionSteps = () => (
  <GuideSection title="Envía una corrección">
    <Steps>
      {steps.map(({ title, description }) => (
        <li key={title}>
          <div>
            <Typography component="h3" variant="h6">
              {title}
            </Typography>
            <Description color="text.secondary">{description}</Description>
          </div>
        </li>
      ))}
    </Steps>
  </GuideSection>
);
