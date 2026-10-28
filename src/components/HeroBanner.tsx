import { Container, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import type { Breakpoint } from '@mui/material/styles';
import type { ReactNode } from 'react';

const Root = styled('header')(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  color: theme.palette.getContrastText(theme.palette.brand.navy),
  backgroundColor: theme.palette.brand.navy,
  paddingBlock: theme.spacing(7),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(11) },
  '&::before, &::after': { pointerEvents: 'none' },
}));

const Content = styled(Container)({ position: 'relative', zIndex: 1 });

const Navigation = styled('div')(({ theme }) => ({ marginBottom: theme.spacing(4) }));

const Layout = styled('div', {
  shouldForwardProp: (prop) => prop !== 'asideBreakpoint',
})<{ asideBreakpoint: Breakpoint }>(({ theme, asideBreakpoint }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: theme.spacing(4),
  [theme.breakpoints.up(asideBreakpoint)]: { flexDirection: 'row', alignItems: 'flex-end' },
}));

const Badges = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
}));

const Copy = styled('div')({ maxWidth: 760, minWidth: 0 });

const Eyebrow = styled(Typography)(({ theme }) => ({ color: theme.palette.brand.yellow }));

const Title = styled('h1')(({ theme }) => ({
  ...theme.typography.h1,
  marginTop: theme.spacing(1),
  marginBottom: 0,
}));

const Description = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  maxWidth: 620,
  color: theme.palette.getContrastText(theme.palette.brand.navy),
  opacity: 0.72,
}));

/**
 * A full-width brand banner with optional navigation, an eyebrow or badges, a display title, a
 * description and an aside that moves beside the copy from `asideBreakpoint` up. Restyle it with
 * `styled(HeroBanner)`; the title is targetable as `[data-hero-title]`.
 */
export const HeroBanner = ({
  navigation,
  eyebrow,
  badges,
  title,
  titleComponent = 'h1',
  description,
  aside,
  asideBreakpoint = 'lg',
  maxWidth = 'xl',
  children,
  className,
}: {
  navigation?: ReactNode;
  eyebrow?: ReactNode;
  badges?: ReactNode;
  title: ReactNode;
  /** Use `p` when another element already provides the page's `h1`. */
  titleComponent?: 'h1' | 'p';
  description?: ReactNode;
  aside?: ReactNode;
  asideBreakpoint?: Breakpoint;
  /** Match the width of the page content below the banner. */
  maxWidth?: Breakpoint;
  children?: ReactNode;
  className?: string;
}) => (
  <Root className={className}>
    <Content maxWidth={maxWidth}>
      {navigation !== undefined && <Navigation>{navigation}</Navigation>}
      <Layout asideBreakpoint={asideBreakpoint}>
        <Copy>
          {eyebrow !== undefined && <Eyebrow variant="overline">{eyebrow}</Eyebrow>}
          {badges !== undefined && <Badges>{badges}</Badges>}
          <Title as={titleComponent} data-hero-title="">
            {title}
          </Title>
          {description !== undefined && <Description>{description}</Description>}
          {children}
        </Copy>
        {aside}
      </Layout>
    </Content>
  </Root>
);
