import { Alert, Button, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { formatIssue } from '@/lib/validation/issues';

import type { ValidationIssue } from '@/lib/validation/issues';

const Layout = styled(Stack)({ alignItems: 'flex-start' });
const FullWidthAlert = styled(Alert)({ alignSelf: 'stretch' });

const IssueList = styled('ul')(({ theme }) => ({
  marginBlock: theme.spacing(1, 0),
  paddingInlineStart: theme.spacing(3),
}));

export const RetryButton = () => (
  <Button
    variant="contained"
    onClick={() => {
      window.location.reload();
    }}
  >
    Reintentar
  </Button>
);

/** Explains a data loading failure, lists its validation issues and offers a reload. */
export const DataLoadError = ({
  title,
  headingLevel = 'h2',
  message,
  issues,
}: {
  title?: string;
  headingLevel?: 'h1' | 'h2';
  message: string;
  issues: ValidationIssue[];
}) => (
  <Layout spacing={2}>
    {title !== undefined && (
      <Typography component={headingLevel} variant="h4">
        {title}
      </Typography>
    )}
    <FullWidthAlert severity="error">
      {message}
      {issues.length > 0 && (
        <IssueList>
          {issues.map((issue) => (
            <li key={`${issue.file}:${issue.location}:${issue.message}`}>{formatIssue(issue)}</li>
          ))}
        </IssueList>
      )}
    </FullWidthAlert>
    <RetryButton />
  </Layout>
);
