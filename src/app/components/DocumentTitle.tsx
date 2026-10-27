/** Sets the document title, suffixed with the application name. */
export const DocumentTitle = ({ children }: { children: string }) => (
  <title>{`${children} | Huron Scoreboards`}</title>
);
