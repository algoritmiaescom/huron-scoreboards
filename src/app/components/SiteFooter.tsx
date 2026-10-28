import GitHub from '@mui/icons-material/GitHub';
import { Button, Container, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link } from 'react-router';

import { appConfig, repositoryLinks } from '@/app/config';

const Footer = styled('footer')(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  marginTop: theme.spacing(8),
  paddingBlock: theme.spacing(4),
}));

const FooterContent = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));

export const SiteFooter = () => (
  <Footer>
    <FooterContent maxWidth="xl">
      <Typography variant="body2" color="text.secondary">
        Historia del ICPC México preservada por la comunidad. Archivo público de solo lectura.
      </Typography>
      <Button component={Link} to="/contribute">
        Cómo corregir datos
      </Button>
      <Button component="a" href={repositoryLinks.home} startIcon={<GitHub />}>
        {appConfig.repository.isPlaceholder
          ? 'GitHub (enlace provisional)'
          : 'Repositorio en GitHub'}
      </Button>
    </FooterContent>
  </Footer>
);
