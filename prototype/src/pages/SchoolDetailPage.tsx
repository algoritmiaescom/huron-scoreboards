import ArrowBack from "@mui/icons-material/ArrowBack"
import GitHub from "@mui/icons-material/GitHub"
import GroupsOutlined from "@mui/icons-material/GroupsOutlined"
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined"
import WorkspacePremium from "@mui/icons-material/WorkspacePremium"
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material"
import { Link, useParams } from "react-router"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  contests,
  getSchool,
  schoolMatchesScope,
  schools,
} from "@/data/mockData"

export default function SchoolDetailPage() {
  const { schoolId = "" } = useParams()
  const theme = useTheme()
  const school = getSchool(schoolId)
  if (!school) {
    return (
      <Container maxWidth="md" sx={{ py: 12, textAlign: "center" }}>
        <Typography variant="overline" color="primary">
          Institución no encontrada
        </Typography>
        <Typography variant="h2" sx={{ mt: 2 }}>
          Esta identidad no se encuentra en el archivo.
        </Typography>
        <Button
          component={Link}
          to="/schools"
          startIcon={<ArrowBack />}
          variant="contained"
          sx={{ mt: 4 }}
        >
          Ver instituciones
        </Button>
      </Container>
    )
  }

  const results = contests
    .flatMap((contest) =>
      contest.standings
        .filter((standing) => schoolMatchesScope(standing.schoolId, school.id))
        .map((standing) => ({
          contest,
          standing,
          unit: getSchool(standing.schoolId),
        })),
    )
    .sort((a, b) => a.contest.date.localeCompare(b.contest.date))
  const seasons = [...new Set(results.map((item) => item.contest.season))]
  const trends = seasons.map((season) => {
    const seasonRows = results.filter((item) => item.contest.season === season)
    return {
      season: String(season),
      bestPlace: Math.min(...seasonRows.map((item) => item.standing.place)),
      solved: seasonRows.reduce((sum, item) => sum + item.standing.solved, 0),
      teams: new Set(seasonRows.map((item) => item.standing.teamId)).size,
    }
  })
  const best = results.length
    ? Math.min(...results.map((item) => item.standing.place))
    : null
  const podiums = results.filter((item) => item.standing.place <= 3)
  const children = schools.filter(
    (candidate) => candidate.parentId === school.id,
  )

  return (
    <>
      <Box
        sx={{
          bgcolor: "brand.navy",
          color: "common.white",
          py: { xs: 5, md: 8 },
        }}
      >
        <Container maxWidth="xl">
          <Button
            component={Link}
            to="/schools"
            startIcon={<ArrowBack />}
            sx={{ color: "common.white", opacity: 0.75 }}
          >
            Todas las instituciones
          </Button>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "flex-end" }}
            gap={4}
            sx={{ mt: 4 }}
          >
            <Box sx={{ maxWidth: 900 }}>
              <Stack direction="row" gap={1} sx={{ mb: 2 }}>
                <Chip
                  label={
                    school.kind === "institution"
                      ? "Vista institucional"
                      : "Unidad académica"
                  }
                  color="secondary"
                />
                <Chip
                  label={school.shortName}
                  sx={{
                    color: "common.white",
                    borderColor: "common.white",
                    opacity: 0.75,
                  }}
                  variant="outlined"
                />
              </Stack>
              <Typography
                variant="h1"
                sx={{ fontSize: { xs: "2.6rem", md: "4.5rem" } }}
              >
                {school.name}
              </Typography>
              <Stack
                direction="row"
                alignItems="center"
                gap={1}
                sx={{ mt: 2, color: "common.white", opacity: 0.7 }}
              >
                <LocationOnOutlined />
                <Typography>
                  {school.city}, {school.state}
                </Typography>
              </Stack>
            </Box>
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "common.white", opacity: 0.6 }}
              >
                Mejor puesto
              </Typography>
              <Typography
                fontFamily='"IBM Plex Mono"'
                fontWeight={700}
                sx={{ color: "brand.yellow", fontSize: "4rem" }}
              >
                {best ? `#${best}` : "—"}
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {school.kind === "institution" ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Vista de toda la institución.</strong> Este perfil reúne
            resultados de {school.shortName} y de {children.length}{" "}
            {children.length === 1
              ? "unidad académica vinculada"
              : "unidades académicas vinculadas"}
            : {children.map((item) => item.shortName).join(", ") || "ninguna"}.
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <strong>Solo esta unidad académica.</strong> Estos resultados
            pertenecen a {school.shortName}, no a todas las unidades de{" "}
            <MuiLink component={Link} to={`/schools/${school.parentId}`}>
              {getSchool(school.parentId ?? "")?.shortName}
            </MuiLink>
            .
          </Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" },
            gap: 2,
          }}
        >
          {[
            ["Temporadas", seasons.length],
            ["Resultados", results.length],
            ["Podios", podiums.length],
            [
              "Problemas resueltos",
              results.reduce((sum, item) => sum + item.standing.solved, 0),
            ],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent>
                <Typography fontFamily='"IBM Plex Mono"' variant="h4">
                  {value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.5fr 1fr" },
            gap: 2,
            mt: 3,
          }}
        >
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="overline" color="primary">
                Tendencia
              </Typography>
              <Typography variant="h5">Mejor puesto por temporada</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Un valor menor es mejor. Enfoca o pasa el cursor sobre un punto
                para ver su valor.
              </Typography>
              <Box
                sx={{ height: 280, mt: 3 }}
                role="img"
                aria-label={`Mejores puestos por temporada: ${trends.map((item) => `${item.season}, puesto ${item.bestPlace}`).join("; ")}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trends}
                    margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke={theme.palette.divider}
                      vertical={false}
                    />
                    <XAxis dataKey="season" />
                    <YAxis reversed domain={[1, 8]} allowDecimals={false} />
                    <Tooltip />
                    <Line
                      dataKey="bestPlace"
                      name="Mejor puesto"
                      stroke={theme.palette.primary.main}
                      strokeWidth={3}
                      dot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="overline" color="primary">
                Podio
              </Typography>
              <Typography variant="h5">Mejores puestos</Typography>
              <Stack gap={1.5} sx={{ mt: 3 }}>
                {podiums.length ? (
                  podiums.slice(0, 5).map(({ contest, standing, unit }) => (
                    <Stack
                      key={`${contest.id}-${standing.teamId}`}
                      direction="row"
                      alignItems="center"
                      gap={2}
                    >
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 2,
                          bgcolor:
                            standing.place === 1
                              ? "secondary.main"
                              : "action.hover",
                        }}
                      >
                        <WorkspacePremium />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={700}>
                          {standing.team}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {contest.season} · {unit?.shortName}
                        </Typography>
                      </Box>
                      <Typography fontFamily='"IBM Plex Mono"' fontWeight={700}>
                        #{standing.place}
                      </Typography>
                    </Stack>
                  ))
                ) : (
                  <Typography color="text.secondary">
                    Aún no hay puestos de podio registrados.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="overline" color="primary">
              Volumen
            </Typography>
            <Typography variant="h5">
              Participación y problemas resueltos
            </Typography>
            <Stack gap={2} sx={{ mt: 3 }}>
              {trends.map((item) => (
                <Box key={item.season}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>
                      Temporada {item.season}
                    </Typography>
                    <Typography variant="body2">
                      {item.teams} equipos · {item.solved} resueltos
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      height: 10,
                      bgcolor: "action.hover",
                      borderRadius: 4,
                      mt: 1,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        width: `${Math.min(100, item.solved * 4)}%`,
                        bgcolor: "primary.main",
                        borderRadius: 4,
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Box sx={{ mt: 5 }}>
          <Typography variant="overline" color="primary">
            Registros por temporada
          </Typography>
          <Typography variant="h4">Equipos y resultados</Typography>
          <Alert severity="info" icon={<GroupsOutlined />} sx={{ my: 2 }}>
            Las identidades de los equipos pertenecen a una sola temporada y no
            se enlazan entre años. Los datos faltantes de integrantes se
            muestran como no disponibles, nunca se infieren.
          </Alert>
          <TableContainer component={Paper} variant="outlined">
            <Table aria-label={`Resultados de ${school.name}`}>
              <TableHead>
                <TableRow>
                  <TableCell>Temporada</TableCell>
                  <TableCell>Competencia</TableCell>
                  <TableCell>Equipo / integrantes</TableCell>
                  {school.kind === "institution" && (
                    <TableCell>Unidad académica</TableCell>
                  )}
                  <TableCell>Puesto</TableCell>
                  <TableCell>Resueltos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...results].reverse().map(({ contest, standing, unit }) => (
                  <TableRow key={`${contest.id}-${standing.teamId}`} hover>
                    <TableCell
                      sx={{ fontFamily: '"IBM Plex Mono"', fontWeight: 700 }}
                    >
                      {contest.season}
                    </TableCell>
                    <TableCell>
                      <MuiLink
                        component={Link}
                        to={`/scoreboards?contest=${contest.id}`}
                      >
                        {contest.name}
                      </MuiLink>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700}>{standing.team}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {standing.roster?.length
                          ? standing.roster.join(" · ")
                          : "Integrantes no disponibles"}
                      </Typography>
                    </TableCell>
                    {school.kind === "institution" && (
                      <TableCell>{unit?.shortName}</TableCell>
                    )}
                    <TableCell
                      sx={{ fontFamily: '"IBM Plex Mono"', fontWeight: 700 }}
                    >
                      #{standing.place}
                    </TableCell>
                    <TableCell sx={{ fontFamily: '"IBM Plex Mono"' }}>
                      {standing.solved}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Divider sx={{ my: 5 }} />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          gap={2}
        >
          <Box>
            <Typography variant="h6">
              ¿Es incorrecta la identidad o algún resultado?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Envía evidencia de una clasificación oficial mediante GitHub.
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/contribute"
            variant="contained"
            startIcon={<GitHub />}
          >
            Corregir estos datos
          </Button>
        </Stack>
      </Container>
    </>
  )
}
