import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, RotateCcw, Megaphone, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseError } from '@/lib/errors';
import { toFa } from '@/lib/persian';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── تعریف تنظیمات ──────────────────────────────────────────────
// هر کلید اینجا تعریف می‌شود تا صفحه خودش را از روی همین بسازد.
// اگر بعداً کلیدی اضافه شد، فقط یک سطر اینجا اضافه می‌شود.

type FieldKind = 'bool' | 'int' | 'text';

interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  unit?: string;
  min?: number;
  max?: number;
}

interface Group {
  title: string;
  note?: string;
  fields: Field[];
}

const GROUPS: Group[] = [
  {
    title: 'جریان لفظ',
    note: 'اعدادی که مستقیماً روی رفتار بات در گروه اثر می‌گذارند.',
    fields: [
      {
        key: 'lafz_ttl_seconds',
        label: 'مهلت لفظ',
        kind: 'int',
        unit: 'ثانیه',
        min: 10,
        max: 600,
        hint: 'از لحظه‌ای که بات لفظ را ثبت می‌کند تا وقتی منقضی شود.',
      },
      {
        key: 'override_window_seconds',
        label: 'پنجرهٔ تأیید مالک',
        kind: 'int',
        unit: 'ثانیه',
        min: 15,
        max: 600,
        hint:
          'بعد از «⏳ تایم»، مالک چقدر فرصت دارد با «ب» تأیید کند. ' +
          'بعد از آن پاسخ «❌ منقضی» است.',
      },
      {
        key: 'absolute_price_threshold',
        label: 'آستانهٔ قیمت مطلق',
        kind: 'int',
        unit: 'تومان',
        min: 1000,
        hint: 'عدد بزرگ‌تر از این، قیمت کامل حساب می‌شود نه لفظ نسبی.',
      },
    ],
  },
  {
    title: 'اعلام نرخ در گروه',
    note:
      'بات بعد از هر معامله نرخ را اعلام نمی‌کند — فقط وقتی هم فاصلهٔ ' +
      'زمانی و هم تغییر قیمت به حد نصاب برسد. اگر تغییر پنج برابر آستانه ' +
      'باشد، فوراً اعلام می‌شود.',
    fields: [
      { key: 'rate_broadcast_enabled', label: 'اعلام نرخ فعال باشد', kind: 'bool' },
      {
        key: 'rate_broadcast_min_interval_sec',
        label: 'حداقل فاصله بین دو اعلام',
        kind: 'int',
        unit: 'ثانیه',
        min: 0,
      },
      {
        key: 'rate_broadcast_min_delta_toman',
        label: 'حداقل تغییر قیمت',
        kind: 'int',
        unit: 'تومان',
        min: 0,
      },
    ],
  },
  {
    title: 'اعلان‌های روزانه',
    fields: [
      {
        key: 'daily_open_notice',
        label: 'افتتاحیهٔ روز',
        kind: 'bool',
        hint: '«بنام خدا» + تاریخ شمسی، سر ساعت شروع. روزهای تعطیل پست نمی‌شود.',
      },
      {
        key: 'daily_close_notice',
        label: 'اختتامیهٔ روز',
        kind: 'bool',
        hint: '«پایان معاملات 📌» سر ساعت قفل.',
      },
    ],
  },
  {
    title: 'ساعت کاری',
    note: 'اعلان‌های روزانه هم از همین ساعت‌ها پیروی می‌کنند.',
    fields: [
      { key: 'trading_open_hour', label: 'ساعت شروع', kind: 'int', min: 0, max: 23 },
      { key: 'trading_open_min', label: 'دقیقهٔ شروع', kind: 'int', min: 0, max: 59 },
      { key: 'trading_lock_hour', label: 'ساعت قفل', kind: 'int', min: 0, max: 23 },
      { key: 'trading_lock_min', label: 'دقیقهٔ قفل', kind: 'int', min: 0, max: 59 },
    ],
  },
  {
    title: 'عضویت و خوش‌آمد',
    fields: [
      {
        key: 'welcome_new_members',
        label: 'خوش‌آمد خودکار',
        kind: 'bool',
        hint: 'وقتی کسی به گروه اضافه می‌شود، بات پیام خوش‌آمد می‌گذارد.',
      },
      {
        key: 'demo_mode_enabled',
        label: 'ثبت‌نام دمو',
        kind: 'bool',
        hint:
          'با /start، درخواست عضویت برای ادمین‌ها فرستاده می‌شود. ' +
          'هیچ حسابی خودکار فعال نمی‌شود — ساخت و فعال‌سازی هنوز دستی است.',
      },
      {
        key: 'demo_units_default',
        label: 'حجم دمو پیش‌فرض',
        kind: 'int',
        unit: 'واحد',
        min: 0,
      },
      { key: 'support_handle', label: 'آیدی پشتیبانی', kind: 'text', hint: 'مثلاً ‎@tt_support' },
      { key: 'accountant_handle', label: 'آیدی حسابداری', kind: 'text' },
    ],
  },
  {
    title: 'تصفیه و کمیسیون',
    fields: [
      {
        key: 'settlement_reverse_minutes',
        label: 'پنجرهٔ برگشت تصفیه',
        kind: 'int',
        unit: 'دقیقه',
        min: 0,
      },
      {
        key: 'referrer_commission_pct',
        label: 'سهم معرف',
        kind: 'int',
        unit: '٪',
        min: 0,
        max: 100,
      },
    ],
  },
];

const ALL_KEYS = GROUPS.flatMap((g) => g.fields.map((f) => f.key));

// system_settings.value از نوع jsonb است، پس هم عدد می‌آید هم رشته
// هم بولین. اینجا به فرم متنی می‌بریم و موقع ذخیره برمی‌گردانیم.
function toInput(v: unknown, kind: FieldKind): string {
  if (v === null || v === undefined) return '';
  if (kind === 'bool') return String(v) === 'true' ? 'true' : 'false';
  if (typeof v === 'string') return v;
  return String(v);
}

function fromInput(raw: string, kind: FieldKind): unknown {
  if (kind === 'bool') return raw === 'true';
  if (kind === 'int') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return raw;
}

interface Announcement {
  id: string;
  kind: string;
  body: string;
  created_at: string;
  posted_at: string | null;
  error: string | null;
}

const KIND_FA: Record<string, string> = {
  settlement: 'تصفیه',
  trade_cancelled: 'لغو معامله',
  notice: 'اعلان',
  market_open: 'افتتاحیه',
  market_close: 'اختتامیه',
  rate: 'نرخ',
};

export default function RoomSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: rows, error }, { data: ann }] = await Promise.all([
        db.from('system_settings').select('key,value').in('key', ALL_KEYS),
        db
          .from('bot_announcements')
          .select('id,kind,body,created_at,posted_at,error')
          .order('created_at', { ascending: false })
          .limit(15),
      ]);
      if (error) throw error;

      const map: Record<string, string> = {};
      for (const g of GROUPS) {
        for (const f of g.fields) {
          const row = (rows ?? []).find((r: { key: string }) => r.key === f.key);
          map[f.key] = toInput(row?.value, f.kind);
        }
      }
      setValues(map);
      setInitial(map);
      setAnnouncements((ann ?? []) as Announcement[]);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // واکشی اولیه از سرور — همان الگوی بقیهٔ صفحات پنل. قاعدهٔ لینت
    // setState-in-effect را برای همین حالت (sync با یک سیستم بیرونی)
    // استثنا می‌کنیم.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
  }, [fetchAll]);

  const dirtyKeys = useMemo(
    () => ALL_KEYS.filter((k) => values[k] !== initial[k]),
    [values, initial],
  );

  async function handleSave() {
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    try {
      const payload = dirtyKeys.map((key) => {
        const field = GROUPS.flatMap((g) => g.fields).find((f) => f.key === key)!;
        return { key, value: fromInput(values[key] ?? '', field.kind) };
      });
      const { error } = await db
        .from('system_settings')
        .upsert(payload, { onConflict: 'key' });
      if (error) throw error;

      setInitial({ ...values });
      toast.success(`${toFa(dirtyKeys.length)} تنظیم ذخیره شد`);
      toast.info('بات تنظیمات را هنگام راه‌اندازی می‌خواند — برای اعمال فوری ری‌استارتش کن.');
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonCard />;

  const labelStyle = { color: 'var(--text-secondary)' } as const;
  const inputCls =
    'w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none';
  const inputStyle = {
    borderColor: 'var(--border-strong)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* سربرگ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            تنظیمات اتاق و بات
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            این مقادیر را بات موقع راه‌اندازی می‌خواند.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setValues({ ...initial })}
            disabled={dirtyKeys.length === 0}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            <RotateCcw size={14} />
            بازگرداندن
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={dirtyKeys.length === 0 || saving}
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold disabled:opacity-40"
            style={{
              backgroundColor: 'var(--accent-surface)',
              color: 'var(--text-on-accent)',
            }}
          >
            <Save size={15} />
            {saving
              ? 'در حال ذخیره…'
              : dirtyKeys.length > 0
                ? `ذخیرهٔ ${toFa(dirtyKeys.length)} تغییر`
                : 'ذخیره'}
          </button>
        </div>
      </div>

      {/* گروه‌های تنظیمات */}
      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="rounded-xl border p-4"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {group.title}
          </h2>
          {group.note && (
            <p className="mt-1 text-xs leading-6" style={{ color: 'var(--text-tertiary)' }}>
              {group.note}
            </p>
          )}

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {group.fields.map((f) => {
              const dirty = values[f.key] !== initial[f.key];
              return (
                <div key={f.key}>
                  <label className="mb-1 flex items-center gap-1.5 text-xs" style={labelStyle}>
                    {f.label}
                    {f.unit && (
                      <span style={{ color: 'var(--text-tertiary)' }}>({f.unit})</span>
                    )}
                    {dirty && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--accent-gold) 18%, transparent)',
                          color: 'var(--accent-gold)',
                        }}
                      >
                        تغییر کرده
                      </span>
                    )}
                  </label>

                  {f.kind === 'bool' ? (
                    <div className="flex gap-2">
                      {(['true', 'false'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setValues((p) => ({ ...p, [f.key]: v }))}
                          className="min-h-11 flex-1 rounded-lg border text-xs font-medium"
                          style={
                            values[f.key] === v
                              ? {
                                  borderColor: 'var(--accent-gold)',
                                  color: 'var(--accent-gold)',
                                  backgroundColor:
                                    'color-mix(in srgb, var(--accent-gold) 10%, transparent)',
                                }
                              : { borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }
                          }
                        >
                          {v === 'true' ? 'روشن' : 'خاموش'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type={f.kind === 'int' ? 'number' : 'text'}
                      inputMode={f.kind === 'int' ? 'numeric' : undefined}
                      dir={f.kind === 'int' ? 'ltr' : undefined}
                      min={f.min}
                      max={f.max}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      className={inputCls}
                      style={{
                        ...inputStyle,
                        ...(f.kind === 'int'
                          ? { fontFamily: 'var(--font-num)', textAlign: 'right' as const }
                          : {}),
                      }}
                    />
                  )}

                  {f.hint && (
                    <p className="mt-1 text-xs leading-6" style={{ color: 'var(--text-tertiary)' }}>
                      {f.hint}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* صندوق خروجی اعلان‌ها */}
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
      >
        <h2
          className="flex items-center gap-2 text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          <Megaphone size={15} />
          صندوق اعلان‌های گروه
        </h2>
        <p className="mt-1 text-xs leading-6" style={{ color: 'var(--text-tertiary)' }}>
          هر تصفیه‌ای که در پنل زده می‌شود، خودکار اینجا صف می‌شود و بات در
          گروه پستش می‌کند. ۱۵ مورد آخر:
        </p>

        {announcements.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="هنوز اعلانی ثبت نشده" />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: 'var(--bg-overlay)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {KIND_FA[a.kind] ?? a.kind}
                  </span>

                  {a.posted_at ? (
                    <span
                      className="flex items-center gap-1 text-[11px]"
                      style={{ color: 'var(--semantic-success)' }}
                    >
                      <CheckCircle2 size={12} />
                      پست شد
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1 text-[11px]"
                      style={{ color: 'var(--semantic-warn)' }}
                    >
                      <Clock size={12} />
                      در صف
                    </span>
                  )}

                  {a.error && (
                    <span className="text-[11px]" style={{ color: 'var(--semantic-danger)' }}>
                      خطا: {a.error}
                    </span>
                  )}
                </div>

                <pre
                  className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-6"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}
                >
                  {a.body}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
