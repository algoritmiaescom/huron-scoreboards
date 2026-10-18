import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AppProviders } from '@/app/providers/AppProviders';

export const renderApp = (ui: ReactNode) => {
  return render(<AppProviders>{ui}</AppProviders>);
};
