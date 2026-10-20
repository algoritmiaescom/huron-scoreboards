import CloseRounded from '@mui/icons-material/CloseRounded';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import MenuRounded from '@mui/icons-material/MenuRounded';
import { Divider, Drawer, IconButton, Stack, Typography, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { NavLink } from 'react-router';

const NavigationLink = styled(NavLink)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minHeight: theme.spacing(5.5),
  padding: theme.spacing(1, 2),
  borderRadius: theme.spacing(8),
  textDecoration: 'none',
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&[aria-current="page"]': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
}));

const DrawerContent = styled('div')(({ theme }) => ({
  width: theme.spacing(35),
  maxWidth: '100vw',
  padding: theme.spacing(2),
}));

const DrawerHeading = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
}));

const DrawerNavigation = styled('nav')(({ theme }) => ({
  paddingTop: theme.spacing(2),
}));

const MenuControl = styled(IconButton)(({ theme }) => ({
  minHeight: theme.spacing(5.5),
  minWidth: theme.spacing(5.5),
}));

const MenuToggle = styled(MenuControl)({ order: -1 });

export const SiteNavigation = () => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (desktop && drawerOpen) {
    setDrawerOpen(false);
  }
  const link = (
    <NavigationLink
      to="/contribute"
      onClick={() => {
        setDrawerOpen(false);
      }}
    >
      <GroupsOutlined />
      Contribuir
    </NavigationLink>
  );

  if (desktop) {
    return <nav aria-label="Navegación principal">{link}</nav>;
  }
  return (
    <>
      <MenuToggle
        aria-label="Abrir navegación"
        aria-expanded={drawerOpen}
        aria-controls={drawerOpen ? 'mobile-navigation' : undefined}
        onClick={() => {
          setDrawerOpen(true);
        }}
      >
        <MenuRounded />
      </MenuToggle>
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
        slotProps={{
          paper: { role: 'dialog', 'aria-label': 'Menú de navegación', 'aria-modal': true },
        }}
      >
        <DrawerContent>
          <DrawerHeading direction="row">
            <Typography variant="subtitle2">huron-scoreboards</Typography>
            <MenuControl
              aria-label="Cerrar navegación"
              onClick={() => {
                setDrawerOpen(false);
              }}
            >
              <CloseRounded />
            </MenuControl>
          </DrawerHeading>
          <Divider />
          <DrawerNavigation id="mobile-navigation" aria-label="Navegación principal">
            {link}
          </DrawerNavigation>
        </DrawerContent>
      </Drawer>
    </>
  );
};
