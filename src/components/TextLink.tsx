import { styled } from '@mui/material/styles';
import { Link } from 'react-router';

/** An in-app link styled as underlined text. */
export const TextLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'underline',
  textUnderlineOffset: '0.15em',
}));
