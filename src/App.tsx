import { flushSync } from 'react-dom';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/routes';

const router = createBrowserRouter(routes);

export const App = () => (
  <RouterProvider
    router={router}
    flushSync={(callback) => {
      flushSync(callback);
    }}
  />
);
