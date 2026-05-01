import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { routes } from './routes';
import { boot } from './boot';

const router = createBrowserRouter(routes);

export default function App() {
  useEffect(() => { boot(); }, []);

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
