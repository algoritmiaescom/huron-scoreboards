import { Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { DocumentTitle } from '@/app/components/DocumentTitle';
import { StatusContainer } from '@/app/components/StatusContainer';

import type { ReactNode } from 'react';

const ActionStack = styled(Stack)({ alignItems: 'flex-start' });

/** A full-page status message with a heading followed by explanations and recovery actions. */
export const StatusPage = ({
  documentTitle,
  eyebrow,
  title,
  children,
}: {
  documentTitle: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) => (
  <StatusContainer maxWidth="md">
    <DocumentTitle>{documentTitle}</DocumentTitle>
    <ActionStack spacing={3}>
      {eyebrow !== undefined && (
        <Typography variant="overline" color="primary">
          {eyebrow}
        </Typography>
      )}
      <Typography component="h1" variant="h2">
        {title}
      </Typography>
      {children}
    </ActionStack>
  </StatusContainer>
);
