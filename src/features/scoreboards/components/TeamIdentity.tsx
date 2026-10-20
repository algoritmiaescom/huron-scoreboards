import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import type { Team } from '../model/schemas';

const Identity = styled('div')({ minWidth: 0, overflowWrap: 'anywhere' });
const Roster = styled('details')(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  '& summary': {
    cursor: 'pointer',
    color: theme.palette.primary.main,
    paddingBlock: theme.spacing(1),
  },
  '& ul': { paddingLeft: theme.spacing(2.5), marginBlock: theme.spacing(0.5) },
}));

export const TeamIdentity = ({ team }: { team: Team }) => (
  <Identity>
    <Typography variant="subtitle2" component="p">
      {team.name}
    </Typography>
    {team.members !== undefined && team.members.length > 0 ? (
      <Roster>
        <summary>Integrantes de {team.name}</summary>
        <ul>
          {team.members.map((member, index) => (
            <li key={`${member.name}-${String(index)}`}>
              {member.name}
              {member.role === undefined
                ? ''
                : ` — ${member.role === 'coach' ? 'Entrenador/a' : 'Concursante'}`}
            </li>
          ))}
        </ul>
      </Roster>
    ) : (
      <Typography variant="caption" color="text.secondary">
        Integrantes no disponibles
      </Typography>
    )}
  </Identity>
);
