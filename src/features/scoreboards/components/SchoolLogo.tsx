import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import { styled } from '@mui/material/styles';
import { useState } from 'react';

import type { School } from '../model/schemas';

const Logo = styled('img')(({ theme }) => ({
  width: theme.spacing(5),
  height: theme.spacing(5),
  objectFit: 'contain',
  flexShrink: 0,
}));

const schoolLogoSource = (logo: string) => (logo.startsWith('logos/') ? `/${logo}` : logo);

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
  if (school.logo === undefined || failedLogo === school.logo) {
    return <SchoolOutlined aria-hidden="true" className={className} />;
  }
  const { logo } = school;
  return (
    <Logo
      className={className}
      src={schoolLogoSource(logo)}
      alt={`Logo de ${school.officialName}`}
      onError={() => {
        console.error(`Could not load school logo: ${school.id}`, logo);
        setFailedLogo(logo);
        onUnavailable?.(logo);
      }}
    />
  );
};
