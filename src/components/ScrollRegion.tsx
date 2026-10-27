import { styled } from '@mui/material/styles';

import type { ReactNode } from 'react';

const Region = styled('div')(({ theme }) => ({
  overflow: 'auto',
  maxHeight: '72dvh',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

/** A keyboard-focusable, labelled region for content that scrolls in both directions. */
export const ScrollRegion = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <Region role="region" aria-label={label} tabIndex={0} className={className}>
    {children}
  </Region>
);
