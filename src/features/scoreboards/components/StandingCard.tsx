import { Card, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { SchoolIdentity } from './SchoolIdentity';
import { TeamIdentity } from './TeamIdentity';
import { formatPlace } from '../model/ranking';

import type { School, Team } from '../model/schemas';
import type { CardProps } from '@mui/material';

const Root = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  minWidth: 0,
  overflowWrap: 'anywhere',
  '& > * + *': { marginTop: theme.spacing(2) },
}));

/** Compact standing row for narrow screens: place and identities followed by row details. */
export const StandingCard = ({
  row,
  children,
  ...props
}: CardProps & { row: { place: number | null; team: Team; school: School | null } }) => (
  <Root {...props}>
    <Typography variant="data">
      {row.place === null ? 'Puesto no publicado' : `Puesto ${formatPlace(row.place)}`}
    </Typography>
    <TeamIdentity team={row.team} />
    <SchoolIdentity school={row.school} />
    {children}
  </Root>
);
