import { useEffect } from 'react';

const defaultDescription =
  'Archivo público de resultados históricos del ICPC México y guía para contribuir a su conservación.';

/** Sets the client-rendered document title and description. */
export const DocumentTitle = ({
  children,
  description = defaultDescription,
}: {
  children: string;
  description?: string;
}) => {
  useEffect(() => {
    document.title = `${children} | Huron Scoreboards`;
    const meta =
      document.head.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.createElement('meta');
    meta.name = 'description';
    meta.content = description;
    if (!meta.isConnected) {
      document.head.append(meta);
    }
  }, [children, description]);

  return null;
};
