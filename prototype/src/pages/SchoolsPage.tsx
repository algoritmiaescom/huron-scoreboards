import ArrowForward from "@mui/icons-material/ArrowForward"
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined"
import Search from "@mui/icons-material/Search"
import SchoolOutlined from "@mui/icons-material/SchoolOutlined"
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { contests, schoolMatchesScope, schools } from "@/data/mockData"

export default function SchoolsPage() {
  const [query, setQuery] = useState("")
  const summaries = useMemo(
    () =>
      schools.map((school) => {
        const results = contests.flatMap((contest) =>
          contest.standings
            .filter((standing) =>
              schoolMatchesScope(standing.schoolId, school.id),
            )
            .map((standing) => ({ contest, standing })),
        )
        return {
          ...school,
          participations: results.length,
          best: results.length
            ? Math.min(...results.map((item) => item.standing.place))
            : null,
          solved: results.reduce((sum, item) => sum + item.standing.solved, 0),
          units: schools.filter((candidate) => candidate.parentId === school.id)
            .length,
        }
      }),
    [],
  )
  const filtered = summaries.filter((school) =>
    `${school.name} ${school.shortName} ${school.city} ${school.state}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
      <Box
        sx={{
          maxWidth: 960,
          position: "relative",
          "&::after": {
            content: '""',
            display: { xs: "none", md: "block" },
            position: "absolute",
            width: 150,
            height: 150,
            border: 18,
            borderColor: "brand.yellow",
            borderRadius: "50%",
            right: -180,
            top: 10,
            opacity: 0.75,
          },
        }}
      >
        <Typography variant="overline" color="primary.main">
          02 — Identidades estables
        </Typography>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: "3.1rem", md: "6rem" }, mt: 1 }}
        >
          Instituciones a través de cada temporada.
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 3, fontSize: "1.1rem", lineHeight: 1.7 }}
        >
          Los equipos se registran para una temporada. Los perfiles de las
          instituciones son el hilo estable para entender el rendimiento a largo
          plazo.
        </Typography>
      </Box>

      <Box
        sx={{
          mt: 6,
          p: 1,
          maxWidth: 680,
          bgcolor: "background.paper",
          borderRadius: 3,
          boxShadow: 3,
        }}
      >
        <TextField
          fullWidth
          label="Buscar instituciones, unidades, ciudades o estados"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2,1fr)",
            lg: "repeat(3,1fr)",
          },
          gap: 3,
          mt: 6,
        }}
      >
        {filtered.map((school) => (
          <Card key={school.id}>
            <CardActionArea
              component={Link}
              to={`/schools/${school.id}`}
              sx={{ height: "100%" }}
            >
              <CardContent
                sx={{
                  p: 3,
                  minHeight: 250,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 2,
                      bgcolor: "brand.yellow",
                      color: "brand.navy",
                      transform: "rotate(-6deg)",
                    }}
                  >
                    <SchoolOutlined />
                  </Box>
                  <Chip
                    label={
                      school.kind === "institution"
                        ? school.units === 1
                          ? "1 unidad académica"
                          : `${school.units || "Sin"} unidades académicas`
                        : "Unidad académica"
                    }
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="h5" sx={{ mt: 3 }}>
                  {school.shortName}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {school.name}
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.5}
                  sx={{ mt: 1.5, color: "text.secondary" }}
                >
                  <LocationOnOutlined fontSize="small" />
                  <Typography variant="caption">
                    {school.city}, {school.state}
                  </Typography>
                </Stack>
                <Stack direction="row" gap={3} sx={{ mt: "auto", pt: 3 }}>
                  <Box>
                    <Typography fontFamily='"IBM Plex Mono"' variant="h6">
                      {school.best ? `#${school.best}` : "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Mejor puesto
                    </Typography>
                  </Box>
                  <Box>
                    <Typography fontFamily='"IBM Plex Mono"' variant="h6">
                      {school.participations}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Resultados
                    </Typography>
                  </Box>
                  <Box sx={{ ml: "auto", alignSelf: "center" }}>
                    <ArrowForward color="primary" />
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Container>
  )
}
