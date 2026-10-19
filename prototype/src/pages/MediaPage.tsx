import ArrowBackIosNew from "@mui/icons-material/ArrowBackIosNew"
import ArrowForwardIos from "@mui/icons-material/ArrowForwardIos"
import Launch from "@mui/icons-material/Launch"
import PlayCircleOutlined from "@mui/icons-material/PlayCircleOutlined"
import Tag from "@mui/icons-material/Tag"
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  Link as MuiLink,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material"
import { useState } from "react"
import { useSearchParams } from "react-router"
import { contests, formatDate, mediaPosts } from "@/data/mockData"
import type { MediaPost } from "@/data/types"

function PostCard({ post }: { post: MediaPost }) {
  const [assetIndex, setAssetIndex] = useState(0)
  const asset = post.assets[assetIndex]
  return (
    <Card
      component="article"
      sx={{ overflow: "hidden", breakInside: "avoid", mb: 2 }}
    >
      {asset && (
        <Box sx={{ position: "relative", bgcolor: "brand.navy" }}>
          <Box
            component="img"
            src={asset.url}
            alt={asset.alt}
            sx={{
              width: "100%",
              maxHeight: 480,
              display: "block",
              objectFit: "cover",
              aspectRatio: "4 / 3",
            }}
          />
          {asset.type === "video" && (
            <PlayCircleOutlined
              aria-label="Video"
              sx={{
                position: "absolute",
                inset: 0,
                m: "auto",
                fontSize: 68,
                color: "common.white",
              }}
            />
          )}
          {post.assets.length > 1 && (
            <>
              <IconButton
                aria-label="Contenido anterior"
                onClick={() =>
                  setAssetIndex(
                    (value) =>
                      (value - 1 + post.assets.length) % post.assets.length,
                  )
                }
                sx={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  bgcolor: "brand.navy",
                  color: "common.white",
                  "&:hover": { bgcolor: "brand.navy" },
                }}
              >
                <ArrowBackIosNew fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Contenido siguiente"
                onClick={() =>
                  setAssetIndex((value) => (value + 1) % post.assets.length)
                }
                sx={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  bgcolor: "brand.navy",
                  color: "common.white",
                  "&:hover": { bgcolor: "brand.navy" },
                }}
              >
                <ArrowForwardIos fontSize="small" />
              </IconButton>
              <Chip
                label={`${assetIndex + 1} / ${post.assets.length}`}
                size="small"
                sx={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  bgcolor: "brand.navy",
                  color: "common.white",
                }}
              />
            </>
          )}
        </Box>
      )}
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" gap={2}>
          <Stack direction="row" gap={1.5}>
            <Avatar src={post.avatar} alt={post.displayName ?? post.username}>
              {post.displayName?.[0] ?? post.username[0]}
            </Avatar>
            <Box>
              <MuiLink
                href={post.profileUrl}
                target="_blank"
                rel="noreferrer"
                color="inherit"
                underline="hover"
                fontWeight={700}
              >
                {post.displayName ?? `@${post.username}`}
              </MuiLink>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                @{post.username} ·{" "}
                {new Intl.DateTimeFormat("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(post.timestamp))}
              </Typography>
            </Box>
          </Stack>
          <Chip label={post.source} size="small" variant="outlined" />
        </Stack>
        {post.title && (
          <Typography variant="h6" sx={{ mt: 2.5 }}>
            {post.title}
          </Typography>
        )}
        <Typography sx={{ mt: post.title ? 1 : 2.5, lineHeight: 1.65 }}>
          {post.body}
        </Typography>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 2 }}>
          {post.hashtags.map((hashtag) => (
            <Chip
              key={hashtag}
              icon={<Tag />}
              label={hashtag}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
        </Stack>
        <Button
          component="a"
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          fullWidth
          variant="outlined"
          endIcon={<Launch />}
          sx={{ mt: 3 }}
        >
          Ver publicación original
        </Button>
      </CardContent>
    </Card>
  )
}

function LoadingFeed() {
  return (
    <Box
      aria-label="Cargando publicaciones"
      aria-busy="true"
      sx={{ columns: { xs: 1, md: 2, lg: 3 }, columnGap: 2 }}
    >
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <Card key={item} sx={{ display: "inline-block", width: "100%", mb: 2 }}>
          <Skeleton variant="rectangular" height={260} />
          <CardContent>
            <Skeleton width="55%" />
            <Skeleton sx={{ mt: 2 }} />
            <Skeleton width="85%" />
            <Skeleton width="35%" sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      ))}
    </Box>
  )
}

export default function MediaPage() {
  const [params] = useSearchParams()
  const state = params.get("state") ?? "ready"
  const latestContest = [...contests]
    .filter((contest) => contest.hashtag)
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <>
      <Box
        sx={{
          bgcolor: "brand.navy",
          color: "common.white",
          py: { xs: 7, md: 11 },
          position: "relative",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            width: 420,
            height: 420,
            border: 60,
            borderColor: "brand.yellow",
            borderRadius: "50%",
            right: { xs: -320, md: -80 },
            top: -190,
            opacity: 0.12,
          },
        }}
      >
        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
          <Typography variant="overline" sx={{ color: "brand.yellow" }}>
            03 — Competencia más reciente
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "3.1rem", md: "6rem" },
              mt: 1,
              maxWidth: 850,
            }}
          >
            Más allá de la clasificación.
          </Typography>
          <Typography sx={{ color: "common.white", opacity: 0.72, mt: 2 }}>
            {latestContest.name} · {formatDate(latestContest.date)}
            {latestContest.location ? ` · ${latestContest.location}` : ""}
          </Typography>
          <Chip
            label={latestContest.hashtag}
            color="secondary"
            sx={{ mt: 3, fontSize: "1rem" }}
          />
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "flex-end" }}
          gap={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="overline" color="primary">
              Publicaciones sociales
            </Typography>
            <Typography variant="h4">Desde la comunidad</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Fuentes: X · Instagram · Facebook · YouTube · LinkedIn
          </Typography>
        </Stack>

        {state === "unavailable" && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            La fuente en vivo no está disponible temporalmente o alcanzó su
            límite de solicitudes. Se muestran las publicaciones guardadas en el
            repositorio como respaldo.
          </Alert>
        )}

        {state === "loading" ? (
          <LoadingFeed />
        ) : state === "empty" ? (
          <Card sx={{ py: 9, textAlign: "center" }}>
            <CardContent>
              <Tag color="disabled" sx={{ fontSize: 56 }} />
              <Typography variant="h4" sx={{ mt: 2 }}>
                Aún no hay publicaciones
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Las publicaciones públicas que usen {latestContest.hashtag}{" "}
                aparecerán aquí cuando estén disponibles.
              </Typography>
              <Button
                component="a"
                href={latestContest.officialUrl}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                sx={{ mt: 3 }}
              >
                Visitar la fuente de la competencia
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ columns: { xs: 1, md: 2, lg: 3 }, columnGap: 2 }}>
            {mediaPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 3 }}>
          Cada recurso multimedia requiere texto alternativo descriptivo en los
          datos versionados. Las tarjetas siempre enlazan a la publicación
          pública original.
        </Alert>
      </Container>
    </>
  )
}
