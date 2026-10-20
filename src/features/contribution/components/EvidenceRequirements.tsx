import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import SourceOutlined from '@mui/icons-material/SourceOutlined';
import { Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { GuideSection } from './GuideSection';

const Checklist = styled('ul')(({ theme }) => ({
  paddingLeft: theme.spacing(2.5),
  margin: 0,
  '& li': { marginTop: theme.spacing(1.5), lineHeight: 1.65 },
}));

export const EvidenceRequirements = () => (
  <Stack spacing={3}>
    <GuideSection title="Se requiere evidencia">
      <SourceOutlined color="primary" />
      <Typography color="text.secondary">
        Los resultados publicados solo cambian cuando una clasificación oficial respalda la
        corrección. Las capturas aportan contexto, pero la URL de la fuente es la evidencia
        principal.
      </Typography>
    </GuideSection>
    <GuideSection title="Qué revisamos">
      <CheckCircleOutlined color="success" />
      <Checklist>
        <li>Temporada, serie, etapa e identidad del concurso y del equipo.</li>
        <li>
          Relación entre institución y unidad académica, sin fusionar escuelas que compiten por
          separado.
        </li>
        <li>Intentos y minuto de aceptación de cada problema, en el orden publicado.</li>
        <li>Fuente oficial, alcance del cambio y validación de referencias.</li>
      </Checklist>
    </GuideSection>
  </Stack>
);
