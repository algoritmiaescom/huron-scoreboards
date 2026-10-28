import { Alert, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';

import { GuideSection } from './GuideSection';

const Rules = styled('ul')(({ theme }) => ({
  paddingLeft: theme.spacing(2.5),
  margin: 0,
  '& li': { marginTop: theme.spacing(1.5), lineHeight: 1.7 },
  '& code': { fontFamily: theme.typography.data.fontFamily },
}));

export const DataRequirements = () => (
  <Stack spacing={3}>
    <GuideSection title="Reglas para transcribir resultados">
      <Rules>
        <li>
          <strong>Los intentos incluyen el envío aceptado.</strong> Un problema resuelto al primer
          intento tiene 1, no 0. Un problema sin intentos usa el estado <code>unattempted</code>.
        </li>
        <li>
          El minuto de aceptación debe estar dentro de la duración conocida del concurso. Los
          problemas no resueltos no suman penalización.
        </li>
        <li>
          No guardes primeros en resolver: se calculan solo cuando todos los equipos tienen detalle
          por problema. Puede haber empates. Los totales publicados se conservan en
          <code>publishedTotals</code>; deben coincidir con los resultados cuando se puedan
          calcular.
        </li>
        <li>
          Si solo hay totales oficiales, usa <code>results: null</code> y registra
          <code>publishedTotals</code> con <code>solved</code> y <code>penalty</code>. Una
          penalización desconocida usa <code>null</code>, no cero. No inventes intentos ni minutos.
          Se permiten equipos con y sin detalle en un mismo concurso.
        </li>
        <li>
          Las fechas, duración y reglas de penalización desconocidas usan <code>null</code>. Si no
          se conoce el conjunto de problemas, usa <code>problems: []</code> con filas de solo
          totales. Fecha 0 usa <code>fecha-0</code> y no es una clasificatoria.
        </li>
        <li>
          Registra <code>penaltyMinutesPerFailedAttempt</code> según las reglas oficiales del
          concurso; no siempre es 20. La penalización de cada problema resuelto es su minuto de
          aceptación más ese valor por los intentos fallidos.
        </li>
        <li>
          Conserva el lugar oficial y los empates. No recalcules la clasificación para hacerla
          coincidir con los totales derivados.
        </li>
        <li>
          La clasificación acumulada es un <code>standing.json</code> separado: conserva el puntaje
          y la clasificación oficiales, con un solo registro por temporada y serie. No inventes un
          concurso acumulado. Usa <code>qualified: null</code> si se desconoce la clasificación; no
          equivale a <code>false</code>.
        </li>
        <li>
          Los equipos se registran en el <code>teams.json</code> de su temporada. Los nombres de
          integrantes y los logos son opcionales: no inventes información ausente.
        </li>
      </Rules>
    </GuideSection>
    <GuideSection title="Multimedia y logos">
      <Rules>
        <li>
          Incluye texto alternativo descriptivo para cada imagen o video, y el enlace original de
          cada publicación.
        </li>
        <li>
          Lista cada publicación una sola vez en <code>postIds</code> de su evento; ese orden será
          el orden de presentación.
        </li>
        <li>
          Los logos pueden usar una URL HTTPS institucional o un archivo en{' '}
          <code>public/logos/</code>, referenciado como <code>logos/escuela.svg</code>. Se aceptan
          nombres slug en minúsculas y extensiones SVG, PNG o WebP.
        </li>
        <li>
          Solo sube logos que el club pueda redistribuir. El texto alternativo del logo se deriva
          del nombre de la escuela, no se guarda en los datos.
        </li>
      </Rules>
    </GuideSection>
    <Alert severity="warning">
      <code>data/mock/</code> contiene resultados inventados, no una fuente oficial. Nunca
      promociones esos archivos al archivo real: transcribe los resultados desde la clasificación
      oficial a <code>data/</code>.
    </Alert>
  </Stack>
);
