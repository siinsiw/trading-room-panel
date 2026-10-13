import { driver, type DriveStep } from 'driver.js';
import { toast } from 'sonner';
import 'driver.js/dist/driver.css';
import { toFa } from '@/lib/persian';
import { prefersReducedMotion } from '@/lib/gsap';
import { PAGE_INTRO } from './content';

// تور قدم‌به‌قدم با driver.js (MIT، بدون وابستگی). استایل راست‌چین و شیشه‌ای
// در globals.css زیر کلاس tt-tour است.
//
// هر قدم به یک [data-tour="..."] می‌چسبد. قدمی که عنصرش در صفحه نیست
// (مثلاً روی موبایل یا قبل از لود داده) خودکار حذف می‌شود.

type Step = { el: string; title: string; body: string; side?: 'top' | 'bottom' | 'left' | 'right' };

const SHELL: Step[] = [
  { el: 'nav', title: 'همهٔ بخش‌ها', body: 'از این نوار به صفحه‌های دیگر بروید. کنار هر آیکون اسمش نوشته شده.', side: 'left' },
  { el: 'search', title: 'جستجو', body: 'Ctrl و K را با هم بزنید (یا همین‌جا کلیک کنید) و اسم صفحه یا کاری که می‌خواهید را بنویسید.' },
  { el: 'session', title: 'ساعت بازار', body: 'سبز یعنی معاملهٔ امروزی باز است و شمارنده می‌گوید تا قفل ۱۳:۳۰ چقدر مانده. بعد از قفل قرمز می‌شود.' },
  { el: 'help', title: 'هر وقت گم شدید', body: 'این دکمه همین راهنما را برای همان صفحه‌ای که هستید نشان می‌دهد، و صفحهٔ کامل «راهنما» را باز می‌کند.' },
];

const PAGE_STEPS: Record<string, Step[]> = {
  '/admin/dashboard': [
    { el: 'hero', title: 'مزنه و روند امروز', body: 'عدد بزرگ مزنهٔ جاری بازاری است که بالای کارت انتخاب کرده‌اید. برای عوض کردنش روی خود عدد بزنید. نمودار، قیمت معامله‌های امروز است.' },
    { el: 'gauge', title: 'سلامت ودیعه‌ها', body: 'نشان می‌دهد معامله‌گرها به‌طور میانگین چقدر از ودیعه‌شان را از دست داده‌اند. از ۷۵٪ هشدار می‌رود و از ۸۵٪ حراج خودکار.' },
    { el: 'attention', title: 'کارهای منتظر شما', body: 'هر کس نزدیک حراج است یا منتظر تأیید عضویت، اینجا می‌آید. روی درخواست عضویت بزنید تا تأییدش کنید.' },
    { el: 'book', title: 'دفتر لفظ', body: 'لفظ‌های باز نزدیک مزنه: قرمز فروش، سبز خرید. نوار پشت هر ردیف یعنی حجم.' },
    { el: 'day', title: 'برنامهٔ امروز', body: 'بعد از قفل ۱۳:۳۰، تصفیهٔ روزانه را از همین دکمه شروع کنید.' },
  ],
};

const SEEN_KEY = 'tt.tour.seen';

export function hasTour(path: string): boolean {
  return Boolean(PAGE_INTRO[path]);
}

export function markTourSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* حالت ناشناس */ }
}

export function tourSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}

/** تور صفحهٔ فعلی: معرفی صفحه ← قدم‌های خود صفحه ← پوستهٔ پنل */
export function startTour(path: string): void {
  // پیشنهاد «اولین بار است؟» دیگر لازم نیست
  toast.dismiss();
  markTourSeen();
  const intro = PAGE_INTRO[path];
  const toStep = (s: Step): DriveStep => ({
    element: `[data-tour="${s.el}"]`,
    popover: { title: s.title, description: s.body, side: s.side ?? 'bottom', align: 'start' },
  });
  const visible = (s: Step) => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${s.el}"]`);
    return Boolean(el && el.offsetParent !== null);
  };

  const steps: DriveStep[] = [
    ...(intro ? [{ popover: { title: intro.title, description: `${intro.body}<br><br>با «بعدی» قسمت‌های همین صفحه را نشانتان می‌دهم.` } }] : []),
    ...(PAGE_STEPS[path] ?? []).filter(visible).map(toStep),
    ...SHELL.filter(visible).map(toStep),
  ];

  const tour = driver({
    steps,
    animate: !prefersReducedMotion(),
    smoothScroll: true,
    allowClose: true,
    overlayColor: '#1B1813',
    overlayOpacity: 0.42,
    stagePadding: 8,
    stageRadius: 22,
    popoverClass: 'tt-tour',
    showProgress: true,
    progressText: 'قدم {{current}} از {{total}}',
    nextBtnText: 'بعدی',
    prevBtnText: 'قبلی',
    doneBtnText: 'تمام',
    // شمارهٔ قدم فارسی شود — driver.js عدد لاتین می‌گذارد
    onPopoverRender: (popover) => {
      popover.progress.textContent = toFa(popover.progress.textContent ?? '');
    },
    onDestroyed: markTourSeen,
  });
  tour.drive();
}
