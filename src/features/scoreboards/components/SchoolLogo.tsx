import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import { styled } from '@mui/material/styles';
import { useState } from 'react';

import { schoolLogoSchema } from '../model/schemas';

import type { School } from '../model/schemas';

const Logo = styled('img')(({ theme }) => ({
  width: theme.spacing(5),
  height: theme.spacing(5),
  objectFit: 'contain',
  flexShrink: 0,
}));

// Re-checked here because the value becomes an image source; unvalidated input renders the fallback.
const schoolLogoSource = (logo: string) =>
  schoolLogoSchema.safeParse(logo).success
    ? logo.startsWith('logos/')
      ? `${import.meta.env.BASE_URL}${logo}`
      : logo
    : undefined;

/** The school logo, falling back to a generic icon when it is missing or fails to load. */
export const SchoolLogo = ({
  school,
  className,
  onUnavailable,
}: {
  school: School;
  className?: string;
  onUnavailable?: (logo: string) => void;
}) => {
  const [failedLogo, setFailedLogo] = useState<string>();
  const { logo } = school;
  const source = logo === undefined ? undefined : schoolLogoSource(logo);
  if (logo === undefined || source === undefined || failedLogo === logo) {
    return <SchoolOutlined aria-hidden="true" className={className} />;
  }
  return (
    <Logo
      className={className}
      src={source}
      alt={`Logo de ${school.officialName}`}
      onError={() => {
        console.error(`Could not load school logo: ${school.id}`, logo);
        setFailedLogo(logo);
        onUnavailable?.(logo);
      }}
    />
  );
};
