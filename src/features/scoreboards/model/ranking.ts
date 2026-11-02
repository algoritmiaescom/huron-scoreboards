export const comparePlaces = (a: number | null, b: number | null): number =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b;

export const formatPlace = (place: number | null | undefined): string =>
  place === null || place === undefined ? 'No publicado' : `#${String(place)}`;

export const bestKnownPlace = (places: readonly (number | null)[]): number | undefined => {
  const known = places.filter((place) => place !== null);
  return known.length === 0 ? undefined : Math.min(...known);
};

export const isPodiumPlace = (place: number | null): boolean => place !== null && place <= 3;

export const isValidPlaceRanking = (
  places: readonly number[],
  ranking: 'competition' | 'dense' = 'competition',
): boolean => {
  const sorted = [...places].sort((a, b) => a - b);
  let expected = 1;
  let index = 0;
  while (index < sorted.length) {
    const place = sorted[index];
    if (place !== expected) {
      return false;
    }
    let tied = 0;
    while (index < sorted.length && sorted[index] === place) {
      tied += 1;
      index += 1;
    }
    expected += ranking === 'dense' ? 1 : tied;
  }
  return true;
};
