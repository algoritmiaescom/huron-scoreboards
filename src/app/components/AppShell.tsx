import { AppBar, Container, Toolbar, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { type ReactNode, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigation } from 'react-router';

import { SiteFooter } from '@/app/components/SiteFooter';
import { SiteNavigation } from '@/app/components/SiteNavigation';
import { ThemeModeControl } from '@/app/components/ThemeModeControl';
import { publicAssetUrl } from '@/lib/publicAsset';

const Root = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
});

const Header = styled(AppBar)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  backdropFilter: 'blur(18px)',
}));

const HeaderToolbar = styled(Toolbar)(({ theme }) => ({
  gap: theme.spacing(1),
  minHeight: theme.spacing(8),
  [theme.breakpoints.up('md')]: { minHeight: theme.spacing(9.5), gap: theme.spacing(2) },
}));

const Brand = styled(Link)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minWidth: 0,
  marginRight: 'auto',
  color: theme.palette.text.primary,
  textDecoration: 'none',
}));

const BrandImage = styled('img')(({ theme }) => ({
  width: theme.spacing(5.5),
  height: theme.spacing(5.5),
  borderRadius: '50%',
  objectFit: 'cover',
  border: `2px solid ${theme.palette.brand.yellow}`,
}));

const BrandText = styled('span')(({ theme }) => ({
  display: 'none',
  [theme.breakpoints.up('sm')]: { display: 'block' },
}));

const BrandAccent = styled('span')(({ theme }) => ({ color: theme.palette.brand.yellow }));

const BrandEyebrow = styled('span')(({ theme }) => ({
  ...theme.typography.caption,
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightBold,
}));

const BrandName = styled('span')(({ theme }) => ({
  display: 'block',
  fontWeight: theme.typography.fontWeightBold,
}));

const Main = styled('main')(({ theme }) => ({
  flexGrow: 1,
  minWidth: 0,
  scrollMarginTop: theme.spacing(12),
}));

const SkipLink = styled('a')(({ theme }) => ({
  position: 'fixed',
  top: theme.spacing(1),
  left: theme.spacing(1),
  zIndex: theme.zIndex.tooltip + 1,
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  transform: 'translateY(-200%)',
  '&:focus': { transform: 'translateY(0)' },
}));

export const AppShell = ({ children }: { children?: ReactNode }) => {
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const previousPath = useRef(pathname);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (previousPath.current !== pathname) {
      main.current?.focus();
      window.scrollTo(0, 0);
      previousPath.current = pathname;
    }
  }, [pathname]);

  return (
    <Root>
      <SkipLink
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
          main.current?.scrollIntoView();
        }}
      >
        Saltar al contenido
      </SkipLink>
      <Header position="sticky" color="inherit" elevation={0}>
        <Container maxWidth="xl">
          <HeaderToolbar disableGutters>
            <Brand to="/">
              <BrandImage
                src={publicAssetUrl('brand/huron-club.jpg')}
                alt="Huron Scoreboards, inicio"
              />
              <BrandText>
                <BrandEyebrow>CLUB DE ALGORITMIA ESCOM</BrandEyebrow>
                <BrandName>
                  huron<BrandAccent>•</BrandAccent>scoreboards
                </BrandName>
              </BrandText>
            </Brand>
            <SiteNavigation />
            <ThemeModeControl />
          </HeaderToolbar>
        </Container>
      </Header>
      <Main id="main-content" ref={main} tabIndex={-1}>
        {navigation.state === 'loading' ? (
          <Typography role="status">Cargando página…</Typography>
        ) : (
          (children ?? <Outlet />)
        )}
      </Main>
      <SiteFooter />
    </Root>
  );
};
