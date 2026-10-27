import { styled } from '@mui/material/styles';
import { Link } from 'react-router';

import type { ComponentProps } from 'react';

const StretchedLink = styled(Link)(({ theme }) => ({
  color: 'inherit',
  textDecoration: 'none',
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    borderRadius: theme.shape.borderRadius,
  },
  '&:focus-visible': { outline: 'none' },
  '&:focus-visible::after': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

/**
 * A link whose hit area stretches over the nearest positioned ancestor, making a whole card
 * clickable while the link keeps a short accessible name. The card must be `position: relative`.
 */
export const CardLink = (props: ComponentProps<typeof StretchedLink>) => (
  <StretchedLink data-card-link="" {...props} />
);
