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
