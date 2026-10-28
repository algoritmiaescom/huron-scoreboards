import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import { IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';

import { useThemeMode } from '@/app/theme/ThemeModeContext';

const Control = styled(IconButton)(({ theme }) => ({
  minWidth: theme.spacing(5.5),
  minHeight: theme.spacing(5.5),
}));

export const ThemeModeControl = () => {
  const { mode, toggleMode } = useThemeMode();
  const label = `Cambiar al tema ${mode === 'light' ? 'oscuro' : 'claro'}`;
  return (
    <Tooltip title={label}>
      <Control aria-label={label} onClick={toggleMode}>
        {mode === 'light' ? <DarkModeOutlined /> : <LightModeOutlined />}
      </Control>
    </Tooltip>
  );
};
