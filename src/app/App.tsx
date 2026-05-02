import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Providers } from './providers';
import { routes } from './routes';
import { boot } from './boot';
import { CustomCursor } from '@/ui/compounds/CustomCursor';
import { OfflineBanner } from '@/ui/compounds/OfflineBanner';

const router = createBrowserRouter(routes);

export default function App() {
  useEffect(() => { boot(); }, []);

  return (
    <Providers>
      <OfflineBanner />
      <CustomCursor />
      <RouterProvider router={router} />
      <Toaster
        position="top-left"
        dir="rtl"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'YekanBakh, Vazirmatn, system-ui, sans-serif',
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-primary)',
          },
        }}
      />
    </Providers>
  );
}
