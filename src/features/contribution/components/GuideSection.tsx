import { Card, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import type { ReactNode } from 'react';

const Section = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  minWidth: 0,
  [theme.breakpoints.up('md')]: { padding: theme.spacing(4) },
}));

const Heading = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

export const GuideSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <Section>
    <Heading variant="h4" variantMapping={{ h4: 'h2' }}>
      {title}
    </Heading>
    {children}
  </Section>
);
