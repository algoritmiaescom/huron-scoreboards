import ArrowBack from "@mui/icons-material/ArrowBack"
import RouteOutlined from "@mui/icons-material/RouteOutlined"
import { Box, Button, Container, Typography } from "@mui/material"
import { Link } from "react-router"

export default function NotFoundPage() {
  return (
    <Container maxWidth="md" sx={{ py: 12, textAlign: "center" }}>
      <RouteOutlined color="disabled" sx={{ fontSize: 64 }} />
      <Typography
        variant="overline"
        color="primary"
        display="block"
        sx={{ mt: 2 }}
      >
        404 · Página vacía
      </Typography>
      <Typography variant="h2" sx={{ mt: 1 }}>
        Esta ruta se salió del grafo.
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        Es posible que la página se haya movido o que la temporada, serie o
        competencia solicitada no exista.
      </Typography>
      <Box>
        <Button
          component={Link}
          to="/scoreboards"
          variant="contained"
          startIcon={<ArrowBack />}
          sx={{ mt: 4 }}
        >
          Volver a clasificaciones
        </Button>
      </Box>
    </Container>
  )
}
