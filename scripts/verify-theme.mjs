/**
 * verify-theme.mjs — صحت‌سنجی بصری تم روشن/تیره روی صفحات بدون احراز هویت.
 *
 * برای بنر خطا واقعاً فرم را با اطلاعات غلط ارسال می‌کند، چون آن بنر
 * تنها جایی است که --semantic-danger به‌صورت تینت استفاده می‌شود و
 * تا وقتی رندر نشود نمی‌دانیم درست توکنی شده یا نه.
 */
import { launch, shoot } from './shot.mjs';

const BASE = process.env.PANEL_URL ?? 'http://localhost:5199';

const browser = await launch();
const page = await browser.newPage();

const problems = [];

// ─── ۱) صفحات ساده، هر دو تم، سه عرض ───────────────────────────
const ROUTES = [
  ['/auth/login', 'login'],
  ['/auth/signup', 'signup'],
  ['/auth/forgot-password', 'forgot'],
];
const VPS = ['laptop', 'tablet', 'mobile'];

for (const [route, slug] of ROUTES) {
  for (const theme of ['dark', 'light']) {
    for (const vp of VPS) {
      const r = await shoot(page, {
        route,
        name: `10-${slug}-${theme}-${vp}`,
        vp,
        theme,
        full: true,
      });
      if (r.overflow > 1) problems.push(`${slug} ${theme} ${vp}: سرریز ${r.overflow}px`);
    }
  }
}

// ─── ۲) بنر خطا — فرم را با اطلاعات غلط ارسال کن ───────────────
for (const theme of ['dark', 'light']) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/auth/login?theme=${theme}`, { waitUntil: 'networkidle2' }).catch(() => {});
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', 'nobody@example.com');
  await page.type('input[type="password"]', 'wrong-password-123');
  await page.click('button[type="submit"]');
  // بنر خطا بعد از پاسخ شبکه می‌آید
  await new Promise((r) => setTimeout(r, 6000));
  await page.screenshot({
    path: `C:\\Users\\Sina\\Desktop\\shots\\11-login-error-${theme}.png`,
  });
  const shown = await page.evaluate(() => document.body.innerText.length);
  console.log(`✅ 11-login-error-${theme}.png  (${shown} کاراکتر متن روی صفحه)`);
}

// ─── ۳) گزارش کنتراست توکن‌های متن روی سطوح ────────────────────
for (const theme of ['dark', 'light']) {
  await page.goto(`${BASE}/auth/login?theme=${theme}`, { waitUntil: 'networkidle2' }).catch(() => {});
  const contrast = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();

    function parse(c) {
      const d = document.createElement('div');
      d.style.color = c;
      document.body.appendChild(d);
      const rgb = getComputedStyle(d).color.match(/\d+/g).map(Number);
      d.remove();
      return rgb;
    }
    function lum([r, g, b]) {
      const a = [r, g, b].map((x) => {
        x /= 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    function ratio(fg, bg) {
      const l1 = lum(parse(fg)), l2 = lum(parse(bg));
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
    }

    return {
      'text-primary / bg-base':      ratio(v('--text-primary'), v('--bg-base')),
      'text-secondary / bg-base':    ratio(v('--text-secondary'), v('--bg-base')),
      'text-tertiary / bg-elevated': ratio(v('--text-tertiary'), v('--bg-elevated')),
      'accent-gold / bg-elevated':   ratio(v('--accent-gold'), v('--bg-elevated')),
      'text-on-accent / accent-surface': ratio(v('--text-on-accent'), v('--accent-surface')),
      'semantic-danger / bg-elevated':  ratio(v('--semantic-danger'), v('--bg-elevated')),
      'semantic-success / bg-elevated': ratio(v('--semantic-success'), v('--bg-elevated')),
    };
  });

  console.log(`\n── کنتراست تم ${theme} ──`);
  for (const [k, r] of Object.entries(contrast)) {
    const ok = r >= 4.5 ? '✅ AA' : r >= 3 ? '⚠️  فقط متن بزرگ' : '❌ افتاده';
    console.log(`  ${String(r).padStart(6)}  ${ok.padEnd(18)} ${k}`);
    if (r < 3) problems.push(`کنتراست ${theme}: ${k} = ${r}`);
  }
}

console.log('\n' + (problems.length ? `⚠️ ${problems.length} مشکل:` : '✅ بدون سرریز و بدون کنتراست افتاده'));
for (const p of problems) console.log('   ', p);

await browser.close();
