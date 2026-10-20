import ArrowForward from "@mui/icons-material/ArrowForward"
import Bolt from "@mui/icons-material/Bolt"
import CheckCircle from "@mui/icons-material/CheckCircle"
import Close from "@mui/icons-material/Close"
import ContentCopy from "@mui/icons-material/ContentCopy"
import ErrorOutlined from "@mui/icons-material/ErrorOutlined"
import GitHub from "@mui/icons-material/GitHub"
import Launch from "@mui/icons-material/Launch"
import Remove from "@mui/icons-material/Remove"
import RestartAlt from "@mui/icons-material/RestartAlt"
import Search from "@mui/icons-material/Search"
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import {
  contests,
  formatDate,
  getSchool,
  schools,
  seasons,
  series,
} from "@/data/mockData"
import type { Contest, ProblemResult, Standing } from "@/data/types"

function ProblemResultCell({
  result,
  problem,
}: {
  result: ProblemResult
  problem: string
}) {
  if (result.status === "unattempted") {
    return (
      <Tooltip title={`${problem}: Sin intentar`}>
        <Box
          tabIndex={0}
          aria-label={`${problem}: Sin intentar`}
          sx={{
            minWidth: 68,
            minHeight: 48,
            display: "grid",
            placeItems: "center",
            borderRadius: 1,
            bgcolor: "scoreboard.unattempted",
            color: "text.secondary",
          }}
        >
          <Remove fontSize="small" />
        </Box>
      </Tooltip>
    )
  }

  if (result.status === "attempted") {
    return (
      <Tooltip
        title={`${problem}: ${result.attempts} intentos fallidos, sin resolver`}
      >
        <Stack
          tabIndex={0}
          aria-label={`${problem}: ${result.attempts} intentos fallidos, sin resolver`}
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={0.5}
          sx={{
            minWidth: 68,
            minHeight: 48,
            borderRadius: 1,
            bgcolor: "scoreboard.attempted",
            color: "scoreboard.attemptedText",
          }}
        >
          <Close sx={{ fontSize: 16 }} />
          <Typography
            fontFamily='"IBM Plex Mono"'
            fontSize="0.75rem"
            fontWeight={700}
          >
            {result.attempts}
          </Typography>
        </Stack>
      </Tooltip>
    )
  }

  return (
    <Tooltip
      title={`${problem}: Resuelto en ${result.attempts} ${
        result.attempts === 1 ? "intento" : "intentos"
      } al minuto ${result.solvedAtMinute}${
        result.firstToSolve ? "; primero en resolver (posible empate)" : ""
      }`}
    >
      <Stack
        tabIndex={0}
        aria-label={`${problem}: Resuelto, ${result.attempts} intentos, minuto ${result.solvedAtMinute}${
          result.firstToSolve ? ", primero en resolver" : ""
        }`}
        alignItems="center"
        justifyContent="center"
        sx={{
          position: "relative",
          minWidth: 68,
          minHeight: 48,
          borderRadius: 1,
          bgcolor: result.firstToSolve
            ? "scoreboard.firstSolve"
            : "scoreboard.solved",
          color: result.firstToSolve
            ? "scoreboard.firstSolveText"
            : "scoreboard.solvedText",
          border: 2,
          borderColor: result.firstToSolve ? "brand.yellow" : "transparent",
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          {result.firstToSolve ? (
            <Bolt sx={{ fontSize: 15 }} />
          ) : (
            <CheckCircle sx={{ fontSize: 14 }} />
          )}
          <Typography
            fontFamily='"IBM Plex Mono"'
            fontSize="0.72rem"
            fontWeight={700}
          >
            {result.attempts} · {result.solvedAtMinute}
          </Typography>
        </Stack>
        {result.firstToSolve && (
          <Typography
            fontSize="0.55rem"
            fontWeight={800}
            letterSpacing="0.08em"
          >
            FTS
          </Typography>
        )}
      </Stack>
    </Tooltip>
  )
}

function ContestHeader({ contest }: { contest: Contest }) {
  const seriesRecord = series.find((item) => item.id === contest.seriesId)
  return (
    <Card
      sx={{ overflow: "hidden", borderTop: 4, borderTopColor: "brand.yellow" }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
        <Breadcrumbs aria-label="Jerarquía de la competencia" sx={{ mb: 2 }}>
          <Typography variant="body2">Temporada {contest.season}</Typography>
          <Typography variant="body2">{seriesRecord?.name}</Typography>
          <Typography variant="body2" color="text.primary" fontWeight={700}>
            {contest.stage}
          </Typography>
        </Breadcrumbs>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          justifyContent="space-between"
          gap={4}
        >
          <Box>
            <Typography variant="overline" color="primary.main">
              Archivo oficial de la competencia
            </Typography>
            <Typography variant="h3" component="h1" sx={{ mt: 0.5 }}>
              {contest.name}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
              <Chip label={formatDate(contest.date)} size="small" />
              {contest.location && (
                <Chip
                  label={contest.location}
                  size="small"
                  variant="outlined"
                />
              )}
              {contest.kind === "contest" && (
                <>
                  <Chip
                    label={`${contest.durationMinutes} min`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Penalización: +${contest.penaltyMinutesPerFailedAttempt} min por intento fallido`}
                    size="small"
                    variant="outlined"
                  />
                </>
              )}
            </Stack>
          </Box>
          <Stack alignItems={{ xs: "stretch", sm: "flex-start" }} gap={1}>
            <Button
              component="a"
              href={contest.officialUrl}
              target="_blank"
              rel="noreferrer"
              variant="contained"
              endIcon={<Launch />}
            >
              Clasificación oficial
            </Button>
            <Button component={Link} to="/contribute" startIcon={<GitHub />}>
              ¿Encontraste un error? Corrige estos datos
            </Button>
          </Stack>
        </Stack>
      </CardContent>
      <Alert severity="info" icon={<ContentCopy />}>
        Archivo construido por la comunidad. Cada resultado publicado puede
        rastrearse hasta su fuente oficial.
      </Alert>
    </Card>
  )
}

function AccumulatedTable({ contest }: { contest: Contest }) {
  const rows = contest.accumulatedStandings ?? []
  const lastQualified = rows.map((row) => row.qualified).lastIndexOf(true)
  return (
    <Box sx={{ mt: 4 }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        Esta es la clasificación acumulada publicada oficialmente; Huron
        Scoreboards no calcula estos puntajes.{" "}
        <MuiLink href={contest.officialUrl} target="_blank" rel="noreferrer">
          Ver fuente.
        </MuiLink>
      </Alert>
      <TableContainer component={Paper} variant="outlined">
        <Table aria-label={`${contest.name} table`}>
          <TableHead>
            <TableRow>
              <TableCell>Puesto</TableCell>
              <TableCell>Equipo</TableCell>
              <TableCell>Institución</TableCell>
              <TableCell align="right">Puntaje</TableCell>
              <TableCell>¿Clasificado?</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => {
              const school = getSchool(row.schoolId)
              return (
                <TableRow
                  key={row.teamId}
                  sx={
                    index === lastQualified
                      ? {
                          "& td": {
                            borderBottom: 4,
                            borderBottomColor: "primary.main",
                          },
                        }
                      : undefined
                  }
                >
                  <TableCell
                    sx={{ fontFamily: '"IBM Plex Mono"', fontWeight: 700 }}
                  >
                    #{row.place}
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={700}>{row.team}</Typography>
                  </TableCell>
                  <TableCell>
                    <MuiLink
                      component={Link}
                      to={`/schools/${school?.parentId ?? school?.id}`}
                    >
                      {school?.shortName}
                    </MuiLink>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontFamily: '"IBM Plex Mono"', fontWeight: 700 }}
                  >
                    {row.score}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={row.qualified ? <CheckCircle /> : <Remove />}
                      label={row.qualified ? "Clasificado" : "No clasificado"}
                      color={row.qualified ? "success" : "default"}
                      variant={row.qualified ? "filled" : "outlined"}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.5 }}>
        <Box sx={{ width: 32, height: 4, bgcolor: "primary.main" }} />
        <Typography variant="caption" color="text.secondary">
          Línea de corte de clasificación
        </Typography>
      </Stack>
    </Box>
  )
}

function MobileStandingCard({
  row,
  contest,
}: {
  row: Standing
  contest: Contest
}) {
  const school = getSchool(row.schoolId)
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" gap={2}>
          <Box>
            <Typography
              fontFamily='"IBM Plex Mono"'
              color="primary.main"
              fontWeight={700}
            >
              #{row.place}
            </Typography>
            <Typography variant="h6">{row.team}</Typography>
            <MuiLink
              component={Link}
              to={`/schools/${school?.parentId ?? school?.id}`}
              variant="body2"
            >
              {school?.shortName}
            </MuiLink>
          </Box>
          <Stack alignItems="flex-end">
            <Typography
              fontFamily='"IBM Plex Mono"'
              variant="h5"
              fontWeight={700}
            >
              {row.solved}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.penalty} de penalización
            </Typography>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 1,
          }}
        >
          {contest.problems.map((problem) => (
            <Stack key={problem.id} direction="row" alignItems="center" gap={1}>
              <Typography
                fontFamily='"IBM Plex Mono"'
                fontWeight={700}
                sx={{ width: 20 }}
              >
                {problem.id}
              </Typography>
              <ProblemResultCell
                problem={problem.id}
                result={row.results[problem.id]}
              />
            </Stack>
          ))}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 2 }}
        >
          {row.roster?.length
            ? row.roster.join(" · ")
            : "Integrantes no disponibles para esta competencia"}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function ScoreboardsPage() {
  const [params, setParams] = useSearchParams()
  const [copied, setCopied] = useState(false)
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up("md"))
  const contest =
    contests.find((item) => item.id === params.get("contest")) ??
    contests.find((item) => item.id === "2024-mexico-final")!
  const query = params.get("team") ?? ""
  const schoolFilter = params.get("school") ?? ""
  const problemFilter = params.get("problem") ?? ""
  const acceptedOnly = params.get("accepted") === "1"
  const firstOnly = params.get("first") === "1"

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next, { replace: true })
  }
  const selectContest = (id: string) => {
    const next = new URLSearchParams()
    next.set("contest", id)
    setParams(next)
  }

  const filtered = useMemo(() => {
    return contest.standings.filter((row) => {
      const haystack =
        `${row.team} ${getSchool(row.schoolId)?.name}`.toLowerCase()
      const result = problemFilter ? row.results[problemFilter] : undefined
      return (
        haystack.includes(query.toLowerCase()) &&
        (!schoolFilter || row.schoolId === schoolFilter) &&
        (!acceptedOnly ||
          (problemFilter ? result?.status === "solved" : row.solved > 0)) &&
        (!firstOnly ||
          (problemFilter
            ? result?.firstToSolve
            : Object.values(row.results).some((item) => item.firstToSolve)))
      )
    })
  }, [acceptedOnly, contest, firstOnly, problemFilter, query, schoolFilter])

  const activeFilters = [
    query && { key: "team", label: `Equipo: ${query}` },
    schoolFilter && {
      key: "school",
      label: `Institución: ${getSchool(schoolFilter)?.shortName}`,
    },
    problemFilter && { key: "problem", label: `Problema ${problemFilter}` },
    acceptedOnly && { key: "accepted", label: "Solo resueltos" },
    firstOnly && { key: "first", label: "Primero en resolver" },
  ].filter(Boolean) as { key: string; label: string }[]

  const availableSeries = series.filter((item) =>
    contests.some(
      (candidate) =>
        candidate.season === contest.season && candidate.seriesId === item.id,
    ),
  )
  const availableContests = contests.filter(
    (item) =>
      item.season === contest.season && item.seriesId === contest.seriesId,
  )

  return (
    <>
      <Box
        sx={{
          bgcolor: "brand.navy",
          color: "common.white",
          py: { xs: 7, md: 11 },
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(90deg, black, transparent 75%)",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: "50%",
            bgcolor: "brand.yellow",
            opacity: 0.12,
            right: -80,
            top: -180,
          },
        }}
      >
        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ lg: "flex-end" }}
            gap={4}
          >
            <Box sx={{ maxWidth: 760 }}>
              <Typography variant="overline" sx={{ color: "brand.yellow" }}>
                01 — Archivo del ICPC México
              </Typography>
              <Typography
                variant="h1"
                sx={{ fontSize: { xs: "3.2rem", md: "6.4rem" }, mt: 1 }}
              >
                Cada solución tiene una historia.
              </Typography>
              <Typography
                sx={{
                  color: "common.white",
                  opacity: 0.72,
                  mt: 2,
                  maxWidth: 620,
                }}
              >
                Explora clasificaciones oficiales por temporadas y series,
                preservadas por la comunidad.
              </Typography>
            </Box>
            <Box
              component="img"
              src="/brand/icpc-mexico.png"
              alt="ICPC Masters México"
              sx={{
                width: { xs: 150, md: 220 },
                filter: "brightness(0) invert(1)",
                opacity: 0.9,
                p: 3,
                border: 1,
                borderColor: "rgba(255,255,255,.18)",
                borderRadius: 5,
                transform: { md: "rotate(3deg)" },
                boxShadow: "0 24px 80px rgba(0,0,0,.28)",
              }}
            />
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            mt: { xs: -6, md: -8 },
            position: "relative",
            zIndex: 2,
            borderRadius: 4,
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} gap={2}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="season-label">Temporada</InputLabel>
              <Select
                labelId="season-label"
                label="Temporada"
                value={contest.season}
                onChange={(event) => {
                  const next = contests.find(
                    (item) => item.season === Number(event.target.value),
                  )
                  if (next) selectContest(next.id)
                }}
              >
                {seasons.map((season) => (
                  <MenuItem key={season} value={season}>
                    Temporada {season}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="series-label">Serie</InputLabel>
              <Select
                labelId="series-label"
                label="Serie"
                value={contest.seriesId}
                onChange={(event) => {
                  const next = contests.find(
                    (item) =>
                      item.season === contest.season &&
                      item.seriesId === event.target.value,
                  )
                  if (next) selectContest(next.id)
                }}
              >
                {availableSeries.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 240, flexGrow: 1 }}>
              <InputLabel id="contest-label">Competencia</InputLabel>
              <Select
                labelId="contest-label"
                label="Competencia"
                value={contest.id}
                onChange={(event) => selectContest(event.target.value)}
              >
                {availableContests.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.stage}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          {contest.season === 2023 && contest.seriesId === "gpm" && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Temporada parcial: solo se conservan dos clasificatorios; no hay
              repechaje ni clasificación acumulada disponibles.
            </Alert>
          )}
        </Paper>

        <ContestHeader contest={contest} />

        {contest.kind === "accumulated" ? (
          <AccumulatedTable contest={contest} />
        ) : (
          <>
            <Paper variant="outlined" sx={{ p: 2, mt: 4 }}>
              <Stack direction={{ xs: "column", lg: "row" }} gap={2}>
                <TextField
                  size="small"
                  label="Nombre del equipo"
                  value={query}
                  onChange={(event) => update("team", event.target.value)}
                  sx={{ flex: 1, minWidth: 220 }}
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
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="school-filter-label">Institución</InputLabel>
                  <Select
                    labelId="school-filter-label"
                    label="Institución"
                    value={schoolFilter}
                    onChange={(event) => update("school", event.target.value)}
                  >
                    <MenuItem value="">Todas las instituciones</MenuItem>
                    {schools
                      .filter((school) =>
                        contest.standings.some(
                          (row) => row.schoolId === school.id,
                        ),
                      )
                      .map((school) => (
                        <MenuItem key={school.id} value={school.id}>
                          {school.shortName}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="problem-filter-label">Problema</InputLabel>
                  <Select
                    labelId="problem-filter-label"
                    label="Problema"
                    value={problemFilter}
                    onChange={(event) => update("problem", event.target.value)}
                  >
                    <MenuItem value="">Todos los problemas</MenuItem>
                    {contest.problems.map((problem) => (
                      <MenuItem key={problem.id} value={problem.id}>
                        {problem.id} · {problem.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <ToggleButton
                  value="accepted"
                  selected={acceptedOnly}
                  onChange={() => update("accepted", acceptedOnly ? "" : "1")}
                  size="small"
                >
                  <CheckCircle sx={{ mr: 1 }} /> Resuelto
                </ToggleButton>
                <ToggleButton
                  value="first"
                  selected={firstOnly}
                  onChange={() => update("first", firstOnly ? "" : "1")}
                  size="small"
                >
                  <Bolt sx={{ mr: 1 }} /> Primero en resolver
                </ToggleButton>
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                gap={2}
              >
                <Stack
                  direction="row"
                  flexWrap="wrap"
                  gap={1}
                  alignItems="center"
                >
                  <Typography variant="body2" fontWeight={700}>
                    {filtered.length} de {contest.standings.length} equipos
                  </Typography>
                  {activeFilters.map((filter) => (
                    <Chip
                      key={filter.key}
                      label={filter.label}
                      onDelete={() => update(filter.key, "")}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                  {activeFilters.length > 0 && (
                    <Chip
                      label="Vista filtrada"
                      color="secondary"
                      size="small"
                    />
                  )}
                </Stack>
                <Stack direction="row" gap={1}>
                  {activeFilters.length > 0 && (
                    <Button
                      size="small"
                      startIcon={<RestartAlt />}
                      onClick={() => selectContest(contest.id)}
                    >
                      Limpiar todo
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={async () => {
                      await navigator.clipboard?.writeText(window.location.href)
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 1800)
                    }}
                  >
                    {copied ? "Enlace copiado" : "Compartir vista filtrada"}
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Stack
              direction="row"
              flexWrap="wrap"
              gap={2}
              sx={{ my: 2 }}
              aria-label="Leyenda de resultados por problema"
            >
              <Chip icon={<Remove />} label="Sin intentar" size="small" />
              <Chip
                icon={<Close />}
                label="Intentado · intentos"
                size="small"
                color="error"
                variant="outlined"
              />
              <Chip
                icon={<CheckCircle />}
                label="Resuelto · intentos + minuto"
                size="small"
                color="success"
                variant="outlined"
              />
              <Chip
                icon={<Bolt />}
                label="Primero en resolver · posibles empates"
                size="small"
                color="warning"
                variant="outlined"
              />
            </Stack>

            {filtered.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{ py: 8, px: 2, textAlign: "center" }}
              >
                <ErrorOutlined color="disabled" sx={{ fontSize: 48 }} />
                <Typography variant="h5" sx={{ mt: 2 }}>
                  Ningún equipo coincide con esta vista filtrada
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Quita uno o más filtros para ver la clasificación.
                </Typography>
                <Button
                  sx={{ mt: 3 }}
                  variant="contained"
                  startIcon={<RestartAlt />}
                  onClick={() => selectContest(contest.id)}
                >
                  Limpiar todos los filtros
                </Button>
              </Paper>
            ) : desktop ? (
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ maxHeight: "72vh" }}
              >
                <Table stickyHeader aria-label={`${contest.name} standings`}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          position: "sticky",
                          left: 0,
                          zIndex: 5,
                          minWidth: 72,
                        }}
                      >
                        Puesto
                      </TableCell>
                      <TableCell
                        sx={{
                          position: "sticky",
                          left: 72,
                          zIndex: 5,
                          minWidth: 200,
                        }}
                      >
                        Equipo
                      </TableCell>
                      <TableCell
                        sx={{
                          position: "sticky",
                          left: 272,
                          zIndex: 5,
                          minWidth: 150,
                          boxShadow: 3,
                        }}
                      >
                        Institución
                      </TableCell>
                      {contest.problems.map((problem) => (
                        <TableCell
                          key={problem.id}
                          align="center"
                          title={problem.title}
                          sx={{ minWidth: 84 }}
                        >
                          <Typography
                            fontFamily='"IBM Plex Mono"'
                            fontWeight={700}
                          >
                            {problem.id}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ display: "block", maxWidth: 74 }}
                          >
                            {problem.title}
                          </Typography>
                        </TableCell>
                      ))}
                      <TableCell align="right">Resueltos</TableCell>
                      <TableCell align="right">Penalización</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((row) => {
                      const school = getSchool(row.schoolId)
                      return (
                        <TableRow hover key={row.teamId}>
                          <TableCell
                            sx={{
                              position: "sticky",
                              left: 0,
                              zIndex: 2,
                              bgcolor: "background.paper",
                              fontFamily: '"IBM Plex Mono"',
                              fontWeight: 700,
                            }}
                          >
                            #{row.place}
                          </TableCell>
                          <TableCell
                            sx={{
                              position: "sticky",
                              left: 72,
                              zIndex: 2,
                              bgcolor: "background.paper",
                            }}
                          >
                            <Typography fontWeight={700}>{row.team}</Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {row.roster?.length
                                ? row.roster.join(" · ")
                                : "Integrantes no disponibles"}
                            </Typography>
                          </TableCell>
                          <TableCell
                            sx={{
                              position: "sticky",
                              left: 272,
                              zIndex: 2,
                              bgcolor: "background.paper",
                              boxShadow: 3,
                            }}
                          >
                            <MuiLink
                              component={Link}
                              to={`/schools/${school?.parentId ?? school?.id}`}
                            >
                              {school?.shortName}
                            </MuiLink>
                            {school?.kind === "unit" && (
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                              >
                                {school.name}
                              </Typography>
                            )}
                          </TableCell>
                          {contest.problems.map((problem) => (
                            <TableCell key={problem.id} align="center">
                              <ProblemResultCell
                                problem={problem.id}
                                result={row.results[problem.id]}
                              />
                            </TableCell>
                          ))}
                          <TableCell
                            align="right"
                            sx={{
                              fontFamily: '"IBM Plex Mono"',
                              fontWeight: 700,
                            }}
                          >
                            {row.solved}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontFamily: '"IBM Plex Mono"' }}
                          >
                            {row.penalty}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Stack gap={2}>
                <Alert severity="info">
                  La vista móvil agrupa los problemas por equipo. Cada resultado
                  conserva su letra, icono, intentos y minuto de resolución.
                </Alert>
                {filtered.map((row) => (
                  <MobileStandingCard
                    key={row.teamId}
                    row={row}
                    contest={contest}
                  />
                ))}
              </Stack>
            )}
          </>
        )}

        <Card
          sx={{ mt: 5, bgcolor: "primary.main", color: "primary.contrastText" }}
        >
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ sm: "center" }}
              gap={2}
            >
              <Box>
                <Typography variant="h6">
                  ¿Encontraste un error en este resultado?
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Las correcciones se hacen públicamente, con evidencia de la
                  fuente oficial.
                </Typography>
              </Box>
              <Button
                component={Link}
                to="/contribute"
                variant="contained"
                color="secondary"
                endIcon={<ArrowForward />}
              >
                Cómo contribuir
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </>
  )
}
