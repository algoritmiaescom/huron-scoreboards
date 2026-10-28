import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import HelpOutlined from '@mui/icons-material/HelpOutlined';
import Remove from '@mui/icons-material/Remove';
import { Chip } from '@mui/material';

export const QualificationChip = ({ qualified }: { qualified: boolean | null }) => (
  <Chip
    icon={qualified === null ? <HelpOutlined /> : qualified ? <CheckCircleOutlined /> : <Remove />}
    label={
      qualified === null
        ? 'Clasificación desconocida'
        : qualified
          ? 'Clasificado'
          : 'No clasificado'
    }
    size="small"
    variant="outlined"
  />
);
