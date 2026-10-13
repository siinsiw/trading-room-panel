import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Providers } from './providers';
import { routes } from './routes';
import { boot } from './boot';
import { OfflineBanner } from '@/ui/compounds/OfflineBanner';

const router = createBrowserRouter(routes);

export default function App() {
  useEffect(() => { boot(); }, []);

  return (
    <Providers>
      <OfflineBanner />
      <RouterProvider router={router} />
      <Toaster
        // پایین، نه بالا: بالا-چپ دقیقاً روی دکمه‌های «راهنما» و پروفایل نوار بالا می‌نشست.
        // روی موبایل بالای نوار پایین شناور (۶۶ + ۸ پیکسل) قرار می‌گیرد.
        position="bottom-left"
        mobileOffset={{ bottom: 86 }}
        dir="rtl"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'var(--font-ui)',
            backgroundColor: 'var(--glass-strong)',
            backdropFilter: 'var(--glass-blur)',
            boxShadow: 'var(--glass-shadow)',
            borderColor: 'transparent',
            borderRadius: 16,
            color: 'var(--text-primary)',
          },
        }}
      />
    </Providers>
  );
}
