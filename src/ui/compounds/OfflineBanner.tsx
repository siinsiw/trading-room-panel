import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
      style={{
        backgroundColor: '#ca8a04',
        color: '#000',
      }}
      dir="rtl"
    >
      {/* Wifi-off icon */}
      <svg
        className="w-4 h-4 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 6c3.6-3.6 8.4-4.9 13-3.8M5 10c2-2 4.7-3 7.4-2.7M9 14l3 3 3-3a4.2 4.2 0 0 0-6 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      اتصال اینترنت قطع است
    </div>
  );
}
