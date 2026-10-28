import ContentCopy from '@mui/icons-material/ContentCopy';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';

export const ShareViewAction = () => {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<{ url: string; message: string }>();
  const share = async () => {
    const url = window.location.href;
    setCopied(false);
    const browser: Partial<Navigator> = navigator;
    const { clipboard } = browser;
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
      setFallback({
        url,
        message: 'El portapapeles no está disponible. Selecciona y copia el enlace manualmente.',
      });
      return;
    }
    setPending(true);
    try {
      await clipboard.writeText(url);
      setCopied(true);
    } catch (error) {
      console.error('Could not copy the scoreboard URL.', error);
      setFallback({
        url,
        message: 'No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Stack spacing={1}>
      <Button
        variant="outlined"
        startIcon={<ContentCopy />}
        onClick={() => {
          void share();
        }}
        disabled={pending}
      >
        Compartir vista
      </Button>
      {copied && (
        <Alert severity="success" role="status">
          Enlace copiado
        </Alert>
      )}
      <Dialog
        open={fallback !== undefined}
        onClose={() => {
          setFallback(undefined);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="share-view-title"
        aria-describedby="share-view-message"
      >
        <DialogTitle id="share-view-title">Compartir clasificación</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning" id="share-view-message">
              {fallback?.message}
            </Alert>
            <TextField
              label="Enlace para compartir"
              value={fallback?.url ?? ''}
              fullWidth
              multiline
              slotProps={{ input: { readOnly: true } }}
              onFocus={(event) => {
                event.target.select();
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setFallback(undefined);
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
