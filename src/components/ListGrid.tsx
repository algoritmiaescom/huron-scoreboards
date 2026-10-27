import { styled } from '@mui/material/styles';

import type { Breakpoint } from '@mui/material/styles';

export type ListGridColumns = Partial<Record<Breakpoint, number>>;

const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/** An unstyled list laid out as a single column that widens at the given breakpoints. */
export const ListGrid = styled('ol', {
  shouldForwardProp: (prop) => prop !== 'columns' && prop !== 'spacing',
})<{ columns?: ListGridColumns; spacing?: number }>(({ theme, columns = {}, spacing = 2 }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(spacing),
  listStyle: 'none',
  margin: 0,
  padding: 0,
  '& > li': { minWidth: 0 },
  ...Object.fromEntries(
    breakpointOrder.flatMap((breakpoint) => {
      const count = columns[breakpoint];
      return count === undefined
        ? []
        : [
            [
              theme.breakpoints.up(breakpoint),
              { gridTemplateColumns: `repeat(${String(count)}, minmax(0, 1fr))` },
            ],
          ];
    }),
  ),
}));
