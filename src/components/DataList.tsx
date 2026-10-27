import { styled } from '@mui/material/styles';

import type { ReactNode } from 'react';

export interface DataListItem {
  label: string;
  value: ReactNode;
}

const List = styled('dl')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  margin: 0,
  '& > div': { minWidth: 0 },
  '& dt': { ...theme.typography.caption, color: theme.palette.text.secondary },
  '& dd': { ...theme.typography.data, margin: 0 },
}));

/** Labelled values rendered as a description list; restyle the layout with `styled(DataList)`. */
export const DataList = ({ items, className }: { items: DataListItem[]; className?: string }) => (
  <List className={className}>
    {items.map(({ label, value }) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </List>
);
