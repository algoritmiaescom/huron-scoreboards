import { Typography } from '@mui/material';

import type { TypographyProps } from '@mui/material';

/** An eyebrow label followed by the section heading. */
export const SectionTitle = ({
  eyebrow,
  title,
  id,
  component = 'h2',
  variant = 'h5',
}: {
  eyebrow: string;
  title: string;
  id?: string;
  component?: 'h1' | 'h2' | 'h3';
  variant?: TypographyProps['variant'];
}) => (
  <>
    <Typography variant="overline" color="primary">
      {eyebrow}
    </Typography>
    <Typography id={id} component={component} variant={variant}>
      {title}
    </Typography>
  </>
);
