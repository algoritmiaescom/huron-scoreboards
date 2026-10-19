import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined"
import GitHub from "@mui/icons-material/GitHub"
import GroupsOutlined from "@mui/icons-material/GroupsOutlined"
import LightModeOutlined from "@mui/icons-material/LightModeOutlined"
import MenuRounded from "@mui/icons-material/MenuRounded"
import NewspaperOutlined from "@mui/icons-material/NewspaperOutlined"
import SchoolOutlined from "@mui/icons-material/SchoolOutlined"
import ScoreboardOutlined from "@mui/icons-material/ScoreboardOutlined"
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import { useContext, useState } from "react"
import { Link, NavLink, Outlet } from "react-router"
import { ColorModeContext } from "@/app/App"

const links = [
  {
    to: "/scoreboards",
    label: "Clasificaciones",
    icon: <ScoreboardOutlined />,
  },
  { to: "/schools", label: "Instituciones", icon: <SchoolOutlined /> },
  { to: "/media", label: "Multimedia", icon: <NewspaperOutlined /> },
  { to: "/contribute", label: "Contribuir", icon: <GroupsOutlined /> },
]

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up("md"))
  const { toggle } = useContext(ColorModeContext)

  const navigation = (
    <Stack
      direction={desktop ? "row" : "column"}
      gap={0.5}
      sx={{ p: desktop ? 0 : 2 }}
    >
      {links.map((item) => (
        <Button
          key={item.to}
          component={NavLink}
          to={item.to}
          onClick={() => setDrawerOpen(false)}
          startIcon={item.icon}
          sx={{
            justifyContent: "flex-start",
            color: "text.secondary",
            "&.active": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
            },
          }}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  )

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: (currentTheme) =>
            alpha(currentTheme.palette.background.paper, 0.82),
          backdropFilter: "blur(18px)",
        }}
      >
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{ minHeight: { xs: 64, md: 76 }, gap: 2 }}
          >
            {!desktop && (
              <IconButton
                aria-label="Abrir navegación"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuRounded />
              </IconButton>
            )}
            <Stack
              component={Link}
              to="/scoreboards"
              direction="row"
              alignItems="center"
              gap={1.5}
              sx={{
                color: "text.primary",
                textDecoration: "none",
                minWidth: 0,
              }}
            >
              <Box
                component="img"
                src="/brand/huron-club.jpg"
                alt="Club de Algoritmos Huron"
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: 2,
                  borderColor: "brand.yellow",
                  boxShadow: 3,
                }}
              />
              <Box sx={{ display: { xs: "none", sm: "block" } }}>
                <Typography
                  variant="caption"
                  color="primary.main"
                  fontWeight={700}
                  letterSpacing="0.12em"
                >
                  CLUB DE ALGORITMOS HURON
                </Typography>
                <Typography fontWeight={700} lineHeight={1.1}>
                  huron
                  <Box component="span" sx={{ color: "brand.yellow" }}>
                    •
                  </Box>
                  scoreboards
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            {desktop && navigation}
            <Tooltip
              title={`Cambiar al tema ${
                theme.palette.mode === "light" ? "oscuro" : "claro"
              }`}
            >
              <IconButton
                onClick={toggle}
                aria-label={`Cambiar al tema ${
                  theme.palette.mode === "light" ? "oscuro" : "claro"
                }`}
              >
                {theme.palette.mode === "light" ? (
                  <DarkModeOutlined />
                ) : (
                  <LightModeOutlined />
                )}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 280, pt: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            gap={1.5}
            sx={{ px: 2, pb: 2 }}
          >
            <Box
              component="img"
              src="/brand/huron-club.jpg"
              alt=""
              sx={{ width: 44, height: 44, borderRadius: "50%" }}
            />
            <Typography fontWeight={700}>huron-scoreboards</Typography>
          </Stack>
          <Divider />
          {navigation}
        </Box>
      </Drawer>

      <Box component="main" id="main-content" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>

      <Box
        component="footer"
        sx={{
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          mt: 12,
        }}
      >
        <Container maxWidth="xl" sx={{ py: 5 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            gap={2}
          >
            <Typography variant="body2" color="text.secondary">
              Historia del ICPC México preservada por la comunidad · Archivo
              público de solo lectura
            </Typography>
            <Button
              component="a"
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              startIcon={<GitHub />}
              size="small"
            >
              Corregir datos en GitHub
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
