import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Remove from '@mui/icons-material/Remove';
import { Chip } from '@mui/material';

export const QualificationChip = ({ qualified }: { qualified: boolean }) => (
  <Chip
    icon={qualified ? <CheckCircleOutlined /> : <Remove />}
    label={qualified ? 'Clasificado' : 'No clasificado'}
    size="small"
    variant="outlined"
  />
);
