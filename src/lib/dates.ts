export const mexicoCityDate = (instant: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((entry) => entry.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Missing calendar date part: ${type}`);
    }
    return value;
  };
  return `${part('year')}-${part('month')}-${part('day')}`;
};

/** Formats a stored `YYYY-MM-DD` calendar date in Spanish without shifting its day. */
export const formatCalendarDate = (
  date: string | null,
  dateStyle: 'long' | 'medium' = 'long',
): string =>
  date === null
    ? 'Fecha desconocida'
    : new Intl.DateTimeFormat('es-MX', { dateStyle, timeZone: 'UTC' }).format(
        new Date(`${date}T00:00:00Z`),
      );

/** Formats an instant in Spanish using Mexico City time. */
export const formatMexicoCityDateTime = (instant: string): string =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(instant));
