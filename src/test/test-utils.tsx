import { render } from '@testing-library/react';

import { AppProviders } from '@/app/providers/AppProviders';

import type { ReactNode } from 'react';

export const renderApp = (ui: ReactNode) => {
  return render(<AppProviders>{ui}</AppProviders>);
};
