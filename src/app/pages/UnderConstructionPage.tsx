import ConstructionIcon from '@mui/icons-material/Construction';
import { Box, Container, Stack, Typography } from '@mui/material';

export function UnderConstructionPage() {
  return (
    <Box
      component="main"
      sx={{
        alignItems: 'center',
        display: 'flex',
        minHeight: '100vh',
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <ConstructionIcon color="primary" sx={{ fontSize: 72 }} />
          <Typography component="h1" variant="h2">
            Under construction
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Huron Scoreboards is being built. Check back soon.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
