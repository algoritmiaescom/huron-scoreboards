import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';
import { Link } from 'react-router';

import type { School } from '../model/schemas';

const Identity = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 0,
  overflowWrap: 'anywhere',
}));

const Logo = styled('img')(({ theme }) => ({
  width: theme.spacing(5),
  height: theme.spacing(5),
  objectFit: 'contain',
  flexShrink: 0,
}));

const IdentityText = styled('div')({ minWidth: 0 });
const SchoolLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'underline',
  textUnderlineOffset: '0.15em',
}));

export const SchoolIdentity = ({
  school,
  href,
  heading = false,
}: {
  school: School;
  href?: string;
  heading?: boolean;
}) => {
  const [failedLogo, setFailedLogo] = useState<string>();
  const name = href ? <SchoolLink to={href}>{school.shortName}</SchoolLink> : school.shortName;
  return (
    <Identity>
      {school.logo !== undefined && failedLogo !== school.logo ? (
        <Logo
          src={school.logo.startsWith('logos/') ? `/${school.logo}` : school.logo}
          alt={`Logo de ${school.officialName}`}
          onError={() => {
            console.error(`Could not load school logo: ${school.id}`, school.logo);
            setFailedLogo(school.logo);
          }}
        />
      ) : (
        <SchoolOutlined aria-hidden="true" />
      )}
      <IdentityText>
        <Typography component={heading ? 'h2' : 'p'} variant={heading ? 'h5' : 'body2'}>
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
