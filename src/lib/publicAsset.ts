// Replaced at build time: the offline build embeds public files, the regular build leaves it empty.
declare const __INLINE_PUBLIC_ASSETS__: Record<string, string>;

/** URL of a file under `public/`, as a data URI in the offline build. */
export const publicAssetUrl = (file: string): string =>
  __INLINE_PUBLIC_ASSETS__[file] ?? `${import.meta.env.BASE_URL}${file}`;

/** A remote asset URL, replaced by its data URI when the offline build downloaded it. */
export const remoteAssetUrl = (url: string): string => __INLINE_PUBLIC_ASSETS__[url] ?? url;
