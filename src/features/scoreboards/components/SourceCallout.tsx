import Launch from '@mui/icons-material/Launch';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link } from 'react-router';

import type { DatasetSource } from '@/lib/data/repository';

const Actions = styled(Stack)(({ theme }) => ({
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
  '& a': { overflowWrap: 'anywhere' },
}));

export const SourceCallout = ({
  source,
  datasetSource,
}: {
  source: string;
  datasetSource: DatasetSource;
}) => {
  const mock = datasetSource === 'mock';
  return (
    <Alert severity={mock ? 'warning' : 'info'}>
      <Typography variant="body2">
        {mock
          ? 'Datos de demostración: resultados inventados. El enlace de ejemplo no es evidencia oficial.'
          : 'Archivo construido por la comunidad. Cada resultado publicado puede rastrearse hasta su fuente oficial.'}
      </Typography>
      <Actions direction="row">
        <Button href={source} endIcon={<Launch />} size="small">
          {mock ? 'Fuente de ejemplo' : 'Clasificación oficial'}
        </Button>
        <Button component={Link} to="/contribute" size="small">
          Cómo corregir estos datos
        </Button>
      </Actions>
    </Alert>
  );
};
