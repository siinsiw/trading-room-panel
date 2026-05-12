// آرم اتاق معاملات تی‌تی — هاست‌شده در Supabase Storage
const LOGO_URL =
  'https://ceuzflgyfudqkbtvpvlw.supabase.co/storage/v1/object/public/libary/Gemini_Generated_Image_38gvow38gvow38gv.webp';

interface LogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function Logo({ size = 48, className, alt = 'تی‌تی' }: LogoProps) {
  return (
    <img
      src={LOGO_URL}
      alt={alt}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      className={className}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}

export const LOGIN_BG_URL =
  'https://ceuzflgyfudqkbtvpvlw.supabase.co/storage/v1/object/public/libary/backG.webp';
