import { Breadcrumbs, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { AccentCard, AccentCardContent } from '@/components';

import { SourceCallout } from './SourceCallout';

import type { DatasetSource } from '@/lib/data/repository';
import type { ReactNode } from 'react';

const Title = styled(Typography)(({ theme }) => ({
  marginBlock: theme.spacing(1, 2),
}));

/** Hierarchy, title and provenance shared by every published standings view. */
export const StandingsHeader = ({
  hierarchyLabel,
  hierarchy,
  eyebrow,
  title,
  headingLevel = 'h1',
  source,
  datasetSource,
  children,
}: {
  hierarchyLabel: string;
  hierarchy: string[];
  eyebrow: string;
  title: string;
  headingLevel?: 'h1' | 'h2';
  source: string;
  datasetSource: DatasetSource;
  children: ReactNode;
}) => (
  <AccentCard>
    <AccentCardContent>
      <Breadcrumbs aria-label={hierarchyLabel}>
        {hierarchy.map((level) => (
          <Typography key={level} variant="body2">
            {level}
          </Typography>
        ))}
      </Breadcrumbs>
      <Typography variant="overline" color="primary">
        {eyebrow}
      </Typography>
      <Title variant="h3" variantMapping={{ h3: headingLevel }}>
        {title}
      </Title>
      {children}
    </AccentCardContent>
    <SourceCallout source={source} datasetSource={datasetSource} />
  </AccentCard>
);
