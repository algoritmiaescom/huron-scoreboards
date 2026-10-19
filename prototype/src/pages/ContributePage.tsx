import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined"
import Code from "@mui/icons-material/Code"
import GitHub from "@mui/icons-material/GitHub"
import Launch from "@mui/icons-material/Launch"
import SourceOutlined from "@mui/icons-material/SourceOutlined"
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material"

const steps = [
  [
    "Encuentra el JSON versionado",
    "Localiza el archivo de la temporada, serie y competencia que contiene el registro.",
  ],
  [
    "Edita solo el valor respaldado por evidencia",
    "Mantén el cambio acotado y conserva el esquema publicado.",
  ],
  [
    "Incluye la fuente oficial",
    "Enlaza la clasificación oficial y explica exactamente qué demuestra.",
  ],
  [
    "Abre un pull request",
    "Una persona responsable del club revisa la identidad, la evidencia y la consistencia de los datos antes de publicar.",
  ],
]

export default function ContributePage() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
      <Box sx={{ maxWidth: 800 }}>
        <Typography variant="overline" color="primary">
          Datos públicos, revisión pública
        </Typography>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: "2.8rem", md: "5rem" }, mt: 1 }}
        >
          ¿Encontraste un error? Corrígelo desde la fuente.
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 3, fontSize: "1.1rem", lineHeight: 1.75 }}
        >
          Huron Scoreboards es de solo lectura. Las correcciones se realizan
          mediante archivos JSON versionados y pull requests revisados en el
          repositorio de GitHub.
        </Typography>
        <Button
          component="a"
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          variant="contained"
          size="large"
          startIcon={<GitHub />}
          endIcon={<Launch />}
          sx={{ mt: 4 }}
        >
          Abrir el repositorio de GitHub
        </Button>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.5fr 1fr" },
          gap: 3,
          mt: 7,
        }}
      >
        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="overline" color="primary">
              Flujo de trabajo
            </Typography>
            <Typography variant="h4">Envía una corrección</Typography>
            <List sx={{ mt: 2 }}>
              {steps.map(([title, description], index) => (
                <ListItem
                  key={title}
                  alignItems="flex-start"
                  divider={index < steps.length - 1}
                  sx={{ px: 0, py: 2.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 48 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        fontFamily: '"IBM Plex Mono"',
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={title}
                    secondary={description}
                    slotProps={{
                      primary: { fontWeight: 700 },
                      secondary: { sx: { mt: 0.5, lineHeight: 1.6 } },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        <Stack gap={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <SourceOutlined color="primary" />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Se requiere evidencia
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, lineHeight: 1.65 }}
              >
                Los resultados publicados solo cambian cuando una clasificación
                oficial respalda la corrección. Las capturas pueden aportar
                contexto, pero la URL de la fuente es la evidencia principal.
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <CheckCircleOutlined color="success" />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Qué revisamos
              </Typography>
              <List dense>
                {[
                  "Identidad de la competencia y del equipo",
                  "Intentos, minuto de resolución y cálculo de penalización",
                  "Relación entre institución y unidad académica",
                  "URL de la fuente y alcance del cambio",
                ].map((item) => (
                  <ListItem key={item} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckCircleOutlined color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Divider sx={{ my: 6 }} />
      <Alert severity="info" icon={<Code />}>
        Esta aplicación no tiene cuentas, pantallas de administración ni
        formularios de edición. El historial de Git es el registro de auditoría
        de cada corrección.
      </Alert>
    </Container>
  )
}
