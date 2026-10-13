/**
 * shot.mjs — اسکرین‌شات از پنل در حال اجرا
 *
 *   node scripts/shot.mjs <route> <name> [--vp mobile] [--theme light] [--full] [--login]
 *   node scripts/shot.mjs --matrix            همهٔ مسیرها × دو تم × سه عرض
 *
 * چرا puppeteer و نه `chrome --screenshot`:
 * ویندوز حداقل عرض پنجره دارد، پس `--window-size=390` عملاً ویوپورت ~۵۰۰px
 * می‌دهد و شات موبایل دروغ از آب درمی‌آید. puppeteer ویوپورت را دقیق ست می‌کند
 * و emulation موبایل (touch + meta viewport) را هم اعمال می‌کند.
 *
 * ورود: اگر PANEL_EMAIL و PANEL_PASSWORD در محیط باشند، --login فرم ورود را
 * پر می‌کند و سشن را در storage.json کش می‌کند تا شات‌های بعدی سریع باشند.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.PANEL_URL ?? 'http://localhost:5199';
const OUT = process.env.SHOTS_DIR ?? 'C:\\Users\\Sina\\Desktop\\shots';
const STATE = path.join(OUT, '.session.json');

export const VIEWPORTS = {
  desktop:  { width: 1920, height: 1080, mobile: false },
  laptop:   { width: 1440, height: 900,  mobile: false },
  small:    { width: 1280, height: 800,  mobile: false },
  tablet:   { width: 834,  height: 1112, mobile: false },
  narrow:   { width: 768,  height: 1024, mobile: false },
  mobile:   { width: 390,  height: 844,  mobile: true  },
  mobileSm: { width: 360,  height: 740,  mobile: true  },
};

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

export async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      // منابع بیرونی (لوگو روی Supabase Storage) headless را معطل می‌کنند
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
    ],
  });
}

async function restoreSession(page) {
  if (!fs.existsSync(STATE)) return false;
  try {
    const entries = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    await page.evaluateOnNewDocument((kv) => {
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    }, entries);
    return true;
  } catch {
    return false;
  }
}

export async function login(page, email, password) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
  await page.type('input[type="email"], input[name="email"]', email, { delay: 10 });
  await page.type('input[type="password"]', password, { delay: 10 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
  ]);
  await new Promise((r) => setTimeout(r, 2500));

  const kv = await page.evaluate(() => {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-')) o[k] = localStorage.getItem(k);
    }
    return o;
  });
  if (Object.keys(kv).length === 0) return false;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(kv), 'utf8');
  return true;
}

export async function shoot(page, { route, name, vp = 'laptop', theme = null, full = false }) {
  const v = VIEWPORTS[vp];
  if (!v) throw new Error('viewport نامعتبر: ' + vp);

  await page.setViewport({
    width: v.width,
    height: v.height,
    deviceScaleFactor: 1,
    isMobile: v.mobile,
    hasTouch: v.mobile,
  });

  let url = BASE + route;
  if (theme) url += (url.includes('?') ? '&' : '?') + 'theme=' + theme;

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, fullPage: full });

  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return document.documentElement.scrollWidth - vw;
  });

  console.log(
    `✅ ${name}.png  [${vp} ${v.width}×${v.height}${theme ? ' ' + theme : ''}]` +
      (overflow > 1 ? `  ⚠️ سرریز افقی ${overflow}px` : ''),
  );
  return { file, overflow };
}

// ─── CLI ────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const route = process.argv[2];
  const name = process.argv[3];
  if (!route || !name) {
    console.error('usage: node scripts/shot.mjs <route> <name> [--vp x] [--theme x] [--full] [--login]');
    process.exit(1);
  }

  const browser = await launch();
  const page = await browser.newPage();

  if (arg('--login')) {
    const ok = (await restoreSession(page)) ||
      (await login(page, process.env.PANEL_EMAIL ?? '', process.env.PANEL_PASSWORD ?? ''));
    if (!ok) console.warn('⚠️ ورود انجام نشد — صفحه احتمالاً به /auth/login هدایت می‌شود.');
  }

  await shoot(page, {
    route,
    name,
    vp: arg('--vp', 'laptop'),
    theme: arg('--theme', null),
    full: Boolean(arg('--full', false)),
  });

  await browser.close();
}
