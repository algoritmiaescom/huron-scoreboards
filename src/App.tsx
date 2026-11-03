import { flushSync } from 'react-dom';
import { createHashRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/routes';

const router = createHashRouter(routes);

export const App = () => (
  <RouterProvider
    router={router}
    flushSync={(callback) => {
      flushSync(callback);
    }}
  />
);
