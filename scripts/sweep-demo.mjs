/**
 * sweep-demo.mjs — ماتریس کامل صفحه‌ها × تم × عرض، روی حالت آفلاین.
 *
 *   node scripts/sweep-demo.mjs                 همه‌چیز
 *   node scripts/sweep-demo.mjs --role admin    فقط صفحه‌های ادمین
 *   node scripts/sweep-demo.mjs --vp mobile     فقط یک عرض
 *
 * چرا جدا از shot.mjs: آنجا برای یک شات تکی و با ورود واقعی نوشته شده.
 * اینجا نیازی به ورود نیست — `?as=<role>` در حالت دمو نشست را می‌سازد — و
 * خروجی اصلی گزارش سرریز افقی است، نه خود تصویر.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// shot.mjs آدرس پایه را از PANEL_URL می‌خواند و پیش‌فرضش پورت پنلِ واقعی
// (۵۱۹۹) است. سرور دمو روی ۵۲۱۰ بالا می‌آید، پس اگر اینجا ست نکنیم شات‌ها
// از یک پورت مرده گرفته می‌شوند و همه‌چیز «صفحهٔ خالی» گزارش می‌شود.
// **پیش از import کردن shot.mjs** ست می‌شود، چون آنجا سرِ ماژول خوانده می‌شود.
const DEMO_URL = process.env.PANEL_URL ?? 'http://localhost:5210';
process.env.PANEL_URL = DEMO_URL;

const { launch, shoot, VIEWPORTS } = await import('./shot.mjs');

const OUT = process.env.SHOTS_DIR ?? 'C:\\Users\\Sina\\Desktop\\shots\\demo';

const ROUTES = {
  admin: [
    ['/admin/dashboard',    'dashboard'],
    ['/admin/markets',      'markets'],
    ['/admin/users',        'users'],
    ['/admin/settlement',   'settlement'],
    ['/admin/trades',       'trades'],
    ['/admin/manual-trade', 'manual-trade'],
    ['/admin/holidays',     'holidays'],
    ['/admin/registrations','registrations'],
    ['/admin/settings',     'settings'],
    ['/admin/profile',      'profile'],
  ],
  accountant: [
    ['/accountant/reports',     'acc-reports'],
    ['/accountant/trades',      'acc-trades'],
    ['/accountant/settlements', 'acc-settlements'],
    ['/accountant/users',       'acc-users'],
  ],
  // نقش trader از پنل برداشته شد (۲۰۲۶-۰۹-۲۲) — معامله فقط در تلگرام.
};

// تم تیره از ۲۰۲۶-۱۰-۱۳ برداشته شد — فقط روشن
const THEMES = ['light'];
const VPS = ['desktop', 'laptop', 'tablet', 'mobile'];

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const onlyRole = arg('--role');
const onlyVp = arg('--vp');
const roles = onlyRole ? [onlyRole] : Object.keys(ROUTES);
const vps = onlyVp ? [onlyVp] : VPS;

process.env.SHOTS_DIR = OUT;
fs.mkdirSync(OUT, { recursive: true });

const browser = await launch();
const page = await browser.newPage();

// خطاهای کنسول را جمع می‌کنیم — یک صفحهٔ سفید معمولاً اینجا خودش را لو می‌دهد
let consoleErrors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // headless با --host-resolver-rules هر میزبان بیرونی را بلاک می‌کند؛
  // این خطا مربوط به کد نیست و کل گزارش را پر می‌کرد.
  if (t.includes('ERR_NAME_NOT_RESOLVED')) return;
  consoleErrors.push(t.slice(0, 200));
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));

const report = [];

for (const role of roles) {
  // یک بار ورود با نقش موردنظر؛ نشست در localStorage می‌ماند
  await page.goto(`${DEMO_URL}/admin/dashboard?demo=1&as=${role}`, {
    waitUntil: 'networkidle2', timeout: 30000,
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));

  for (const [route, slug] of ROUTES[role]) {
    for (const theme of THEMES) {
      for (const vp of vps) {
        if (!VIEWPORTS[vp]) continue;
        consoleErrors = [];
        const name = `${slug}-${theme}-${vp}`;
        let res;
        try {
          res = await shoot(page, { route, name, vp, theme, full: false });
        } catch (err) {
          report.push({ slug, route, theme, vp, error: String(err).slice(0, 160) });
          continue;
        }

        // آیا صفحه واقعاً محتوا دارد یا فقط پوسته؟
        const probe = await page.evaluate(() => {
          const main = document.querySelector('main');
          const text = (main?.innerText ?? '').trim();
          return {
            chars: text.length,
            loading: /در حال بارگذاری/.test(text),
            empty: text.length < 40,
            h: document.documentElement.scrollHeight,
          };
        });

        report.push({
          slug, route, theme, vp,
          overflow: res.overflow,
          chars: probe.chars,
          loading: probe.loading,
          empty: probe.empty,
          errors: consoleErrors.slice(0, 3),
        });
      }
    }
  }
}

await browser.close();

// ─── گزارش ──────────────────────────────────────────────────────
const bad = report.filter(
  (r) => r.error || r.overflow > 1 || r.empty || r.loading || (r.errors?.length ?? 0) > 0,
);

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

console.log('\n══════════ خلاصه ══════════');
console.log(`کل ترکیب‌ها: ${report.length}`);
console.log(`مشکل‌دار:    ${bad.length}`);
if (bad.length) {
  console.log('\n--- موارد مشکل‌دار ---');
  for (const r of bad) {
    const flags = [];
    if (r.error) flags.push('خطا:' + r.error);
    if (r.overflow > 1) flags.push(`سرریز ${r.overflow}px`);
    if (r.loading) flags.push('گیرکرده روی بارگذاری');
    else if (r.empty) flags.push(`محتوای خالی (${r.chars} کاراکتر)`);
    if (r.errors?.length) flags.push('console: ' + r.errors.join(' | '));
    console.log(`  ${r.slug} [${r.theme}/${r.vp}] → ${flags.join(' · ')}`);
  }
}
console.log(`\nگزارش کامل: ${path.join(OUT, 'report.json')}`);
