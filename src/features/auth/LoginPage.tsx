import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import { gsap, prefersReducedMotion, SplitText, useGSAP } from '@/lib/gsap';
import { useAuthStore } from '@/stores/auth.store';
import { FloatField } from '@/ui/primitives/FloatField';
import { SealStamp } from '@/ui/compounds/SealStamp';

const schema = z.object({
  email: z.string().email('ایمیل معتبر وارد کنید'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

type FormData = z.infer<typeof schema>;
type Phase = 'idle' | 'busy' | 'ok';

// ─── دکمه: متن چرخان + حلقه‌ای که به تیک تبدیل می‌شود ──────────────────────

const RING = 'M12,3 A9,9 0 1,1 11.99,3';
const CHECK = 'M5.5,12.5 L10,17 L18.5,7.5';
const LABEL: Record<Phase, string> = { idle: 'ورود', busy: 'در حال بررسی…', ok: 'تأیید شد' };

/** متن دکمه با چرخش عمودی عوض می‌شود — کلمه‌ای، تا اتصال حروف فارسی نشکند */
function RollLabel({ text }: { text: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [items, setItems] = useState([{ k: 0, t: text }]);
  const [last, setLast] = useState(text);
  if (last !== text) {
    setLast(text);
    setItems((it) => [it[it.length - 1]!, { k: it[it.length - 1]!.k + 1, t: text }]);
  }

  useLayoutEffect(() => {
    if (items.length < 2 || !box.current) return;
    const [out, inn] = Array.from(box.current.children) as HTMLElement[];
    const d = prefersReducedMotion() ? 0 : 0.45;
    const tl = gsap.timeline({ onComplete: () => setItems((it) => it.slice(-1)) });
    tl.to(out!, { yPercent: -100, duration: d, ease: 'power3.out' }, 0)
      .fromTo(inn!, { yPercent: 100 }, { yPercent: 0, duration: d, ease: 'power3.out' }, 0);
    return () => { tl.kill(); };
  }, [items]);

  return (
    <span ref={box} className="relative block h-[1.6em] overflow-hidden leading-[1.6em]">
      {items.map((it) => <span key={it.k} className="absolute inset-0">{it.t}</span>)}
    </span>
  );
}

function SubmitButton({ phase }: { phase: Phase }) {
  const wrap = useRef<SVGSVGElement>(null);
  const ring = useRef<SVGPathElement>(null);

  useEffect(() => {
    const r = ring.current, w = wrap.current;
    if (!r || !w) return;
    const reduce = prefersReducedMotion();
    let spin: gsap.core.Timeline | undefined;
    if (phase === 'busy') {
      gsap.set(r, { morphSVG: RING, drawSVG: '0% 30%', rotation: 0, transformOrigin: '50% 50%' });
      gsap.to(w, { autoAlpha: 1, duration: 0.2 });
      if (!reduce) {
        spin = gsap.timeline({ repeat: -1 })
          .to(r, { rotation: 360, duration: 0.9, ease: 'none' }, 0)
          .to(r, { drawSVG: '0% 75%', duration: 0.45, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
      }
    } else if (phase === 'ok') {
      gsap.set(r, { rotation: 0, drawSVG: '0% 100%' });
      gsap.to(r, { morphSVG: CHECK, duration: reduce ? 0 : 0.45, ease: 'power2.inOut' });
    } else {
      gsap.to(w, { autoAlpha: 0, duration: 0.2 });
    }
    return () => { spin?.kill(); };
  }, [phase]);

  useEffect(() => () => { gsap.killTweensOf([ring.current, wrap.current]); }, []);

  return (
    <button
      type="submit"
      disabled={phase !== 'idle'}
      className="relative mt-2 h-[50px] w-full overflow-hidden rounded-full text-[16px] font-bold disabled:cursor-wait"
      style={{
        color: '#2A2111',
        background: 'linear-gradient(180deg, #E8B95A, #C8962F)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55), 0 10px 22px -10px rgba(138,97,20,.65)',
      }}
    >
      <svg ref={wrap} viewBox="0 0 24 24" aria-hidden className="absolute left-4 top-1/2 h-[22px] w-[22px] -translate-y-1/2" style={{ opacity: 0, visibility: 'hidden' }}>
        <path ref={ring} d={RING} fill="none" stroke="#2A2111" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <RollLabel text={LABEL[phase]} />
    </button>
  );
}

// ─── چشم رمز: دو آیکون که با چرخش جای هم را می‌گیرند ────────────────────────

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const open = useRef<HTMLSpanElement>(null);
  const shut = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const d = first.current || prefersReducedMotion() ? 0 : 0.28;
    first.current = false;
    const [out, inn] = shown ? [open.current, shut.current] : [shut.current, open.current];
    gsap.to(out, { rotation: -90, autoAlpha: 0, scale: 0.6, duration: d, overwrite: true });
    gsap.fromTo(inn, { rotation: 90, autoAlpha: 0, scale: 0.6 }, { rotation: 0, autoAlpha: 1, scale: 1, duration: d, delay: d * 0.3, overwrite: true });
  }, [shown]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'پنهان کردن رمز' : 'نمایش رمز'}
      aria-pressed={shown}
      className="relative grid h-10 w-10 place-items-center rounded-[11px] transition-colors hover:bg-[var(--surface-tint)]"
      style={{ color: 'var(--text-tertiary)' }}
    >
      <span ref={open} className="absolute"><Eye size={19} strokeWidth={1.7} /></span>
      <span ref={shut} className="absolute" style={{ opacity: 0, visibility: 'hidden' }}><EyeOff size={19} strokeWidth={1.7} /></span>
    </button>
  );
}

// ─── صفحه ────────────────────────────────────────────────────────────────────

/**
 * ورود — «مهر طلایی»: برچسب شناور با خط حکاکی، چشم متحرک، هشدار Caps Lock،
 * لرزش کارت روی خطا، و مهر گاو-خرس روی کارت بعد از ورود موفق.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const destination = useRef('/');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [caps, setCaps] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  // عنوان کلمه‌به‌کلمه از پشت ماسک بالا می‌آید (الگوی Text masking در GSAP)
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const split = SplitText.create(title.current, { type: 'words', mask: 'words' });
      gsap.from(split.words, { yPercent: 110, stagger: 0.07, duration: 0.8, delay: 0.6, ease: 'power3.out' });
    });
    return () => mm.revert();
  }, { scope: root });

  /** لرزش کوتاه و میرا روی کارت شیشه‌ای — فقط x */
  const shake = () => {
    const card = root.current?.closest('.auth-card');
    if (!card || prefersReducedMotion()) return;
    gsap.to(card, { keyframes: { x: [-9, 8, -6, 4, -2, 0] }, duration: 0.5, ease: 'power1.out', overwrite: 'auto' });
  };

  const fail = (msg: string) => {
    setServerError(msg);
    setPhase('idle');
    shake();
  };

  const onSubmit = async (data: FormData) => {
    setServerError('');
    setPhase('busy');
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) { fail(parseError(error)); return; }
      if (!signInData.user) { fail('ورود ناموفق'); return; }

      // پروفایل را خودمان با id کاربر می‌گیریم — onAuthStateChange هم
      // به‌صورت موازی اجرا می‌شود ولی dedup داخل loadProfile رفع تداخل می‌کند.
      await useAuthStore.getState().loadProfile(signInData.user.id);
      const profile = useAuthStore.getState().profile;

      if (!profile) { fail('خطا در بارگذاری پروفایل. دوباره تلاش کنید.'); return; }

      if (profile.role === 'admin') destination.current = '/admin/dashboard';
      else if (profile.role === 'accountant') destination.current = '/accountant/reports';
      // مسیرهای /trader/* از ۲۰۲۶-۰۹-۲۲ نیستند؛ معامله‌گر فقط تلگرام دارد
      else if (profile.active) destination.current = '/auth/telegram-only';
      else destination.current = '/auth/pending-approval';

      setPhase('ok'); // مهر زده می‌شود؛ رفتن به پنل در onDone
    } catch (err) {
      fail(parseError(err));
    }
  };

  const password = register('password', {
    onChange: () => { if (serverError) setServerError(''); },
  });
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'));

  return (
    <div ref={root}>
      <h1 ref={title} className="mb-1 text-[23px] font-bold leading-normal" style={{ color: 'var(--text-primary)' }}>
        ورود به اتاق معاملات
      </h1>
      <p className="mb-6 text-[14.5px]" style={{ color: 'var(--text-tertiary)' }}>
        خوش آمدید. اطلاعات حساب خود را وارد کنید.
      </p>

      {/* handleSubmit داخل رویداد ساخته می‌شود، نه حین رندر — shake به ref کارت دست می‌زند */}
      <form onSubmit={(e) => void handleSubmit(onSubmit, () => shake())(e)} noValidate className="space-y-4">
        <FloatField
          label="ایمیل"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          error={errors.email?.message}
          {...register('email', { onChange: () => { if (serverError) setServerError(''); } })}
        />

        <FloatField
          label="رمز عبور"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          dir="ltr"
          error={errors.password?.message || serverError || undefined}
          note={caps ? 'Caps Lock روشن است — رمز را با حروف کوچک بنویسید.' : undefined}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          end={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          {...password}
        />

        <SubmitButton phase={phase} />
      </form>

      <div className="mt-5 flex flex-col items-center gap-2 text-[14px]">
        <Link to="/auth/forgot-password" className="hover:underline" style={{ color: 'var(--gold-deep)' }}>
          رمز را فراموش کردید؟
        </Link>
        {/* ثبت‌نام از سایت برداشته شد (۲۰۲۶-۰۹-۲۲): عضویت فقط از بات
            تلگرام انجام می‌شود و این پنل فقط برای مدیر و حسابدار است. */}
        <span className="text-center text-[13px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          این پنل فقط برای مدیر و حسابدار است.
          <br />
          عضویت معامله‌گران از ربات تلگرام انجام می‌شود.
        </span>
      </div>

      <SealStamp play={phase === 'ok'} onDone={() => navigate(destination.current)} />
    </div>
  );
}
