import { execSync } from 'child_process';
import { watch } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, 'src');

let debounceTimer = null;
let isPushing = false;

const time = () => new Date().toLocaleTimeString('fa-IR');
const log = (msg) => console.log(`[${time()}] ${msg}`);

function syncNow() {
  if (isPushing) return;
  isPushing = true;

  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: __dirname });
    if (!status.trim()) {
      log('بدون تغییر جدید');
      return;
    }

    log('در حال commit و push...');
    execSync('git add src/ package.json package-lock.json', { cwd: __dirname, stdio: 'inherit' });

    const msg = `auto: sync ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;
    execSync(`git commit -m "${msg}"`, { cwd: __dirname, stdio: 'inherit' });
    execSync('git push origin main', { cwd: __dirname, stdio: 'inherit' });

    log('✓ push شد — ورسل در حال deploy است');
  } catch (err) {
    log(`خطا: ${err.message}`);
  } finally {
    isPushing = false;
  }
}

function scheduleSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(syncNow, 2500);
}

log(`در حال مراقبت از src/ ...`);
log('هر تغییری در فایل‌ها، ۲.۵ ثانیه بعد push می‌شه\n');

watch(SRC_DIR, { recursive: true }, (event, filename) => {
  if (!filename) return;
  log(`تغییر: ${filename}`);
  scheduleSync();
});
