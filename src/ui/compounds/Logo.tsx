// آرم اتاق معاملات تی‌تی.
//
// قبلاً آدرس هر دو تصویر مستقیم به Supabase Storage پروژهٔ قدیم سنجاق شده بود؛
// با از بین رفتن آن پروژه هر دو ۴۰۴ شدند و پنل «عکس شکسته» نشان می‌داد.
// حالا آدرس‌ها از env می‌آیند و اگر تنظیم نشده باشند (یا لود نشوند) یک نشان
// برداری درون‌خطی جای آرم می‌نشیند — بدون وابستگی به شبکه.

import { useState } from 'react';
import { LOGO_URL } from './brand';

interface LogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

function LogoMark({ size, className, alt }: Required<Pick<LogoProps, 'size'>> & LogoProps) {
  // نشان جایگزین: دو «ت» درهم، با همان طلایی تم
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
      <rect x="1" y="1" width="46" height="46" rx="12"
        fill="none" stroke="var(--accent-gold)" strokeWidth="2" />
      <text
        x="24" y="31"
        textAnchor="middle"
        fontSize="19"
        fontWeight="700"
        fill="var(--accent-gold)"
        fontFamily="inherit"
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
