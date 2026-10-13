// آرم اتاق معاملات تی‌تی.
//
// قبلاً آدرس هر دو تصویر مستقیم به Supabase Storage پروژهٔ قدیم سنجاق شده بود؛
// با از بین رفتن آن پروژه هر دو ۴۰۴ شدند و پنل «عکس شکسته» نشان می‌داد.
// حالا آدرس‌ها از env می‌آیند و اگر تنظیم نشده باشند (یا لود نشوند) یک نشان
// برداری درون‌خطی جای آرم می‌نشیند — بدون وابستگی به شبکه.

import { useId, useState } from 'react';
import { LOGO_URL } from './brand';

interface LogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

function LogoMark({ size, className, alt }: Required<Pick<LogoProps, 'size'>> & LogoProps) {
  // نشان جایگزین: کاشی طلایی با «تی‌تی» سفید — همان کاشی ریل ناوبری
  const gid = `logo-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={alt}
      className={className}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#E8B95A" />
          <stop offset="1" stopColor="#A9761C" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="14" fill={`url(#${gid})`} />
      <rect x="0.5" y="0.5" width="47" height="47" rx="13.5" fill="none" stroke="rgba(255,255,255,.45)" />
      <text
        x="24" y="30.5"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="#fff"
        fontFamily="var(--font-ui)"
      >
        تی‌تی
      </text>
    </svg>
  );
}

export function Logo({ size = 48, className, alt = 'تی‌تی' }: LogoProps) {
  const [failed, setFailed] = useState(false);

  if (!LOGO_URL || failed) {
    return <LogoMark size={size} className={className} alt={alt} />;
  }

  return (
    <img
      src={LOGO_URL}
      alt={alt}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}
