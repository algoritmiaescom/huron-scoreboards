import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';

import { CardLink, TextLink } from '@/components';

import { SchoolLogo } from './SchoolLogo';

import type { School } from '../model/schemas';

const Identity = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 0,
  overflowWrap: 'anywhere',
}));

const IdentityText = styled('div')({ minWidth: 0 });

export const SchoolIdentity = ({
  school,
  href,
  stretchLink = false,
  heading,
}: {
  school: School;
  href?: string;
  /** Stretch the link over the enclosing card so the whole card is clickable. */
  stretchLink?: boolean;
  heading?: 'h1' | 'h2';
}) => {
  const [failedLogo, setFailedLogo] = useState<string>();
  const Anchor = stretchLink ? CardLink : TextLink;
  const name = href ? <Anchor to={href}>{school.shortName}</Anchor> : school.shortName;
  return (
    <Identity>
      <SchoolLogo school={school} onUnavailable={setFailedLogo} />
      <IdentityText>
        <Typography
          component={heading ?? 'p'}
          variant={heading === 'h1' ? 'h3' : heading === 'h2' ? 'h5' : 'body2'}
        >
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {school.officialName}
        </Typography>
        {(school.city !== undefined || school.state !== undefined) && (
          <Typography variant="caption" component="p" color="text.secondary">
            {[school.city, school.state].filter((part) => part !== undefined).join(', ')}
          </Typography>
        )}
        {school.logo !== undefined && failedLogo === school.logo && (
          <Typography variant="caption" component="p" color="text.secondary">
            Logo no disponible
          </Typography>
        )}
      </IdentityText>
    </Identity>
  );
};
