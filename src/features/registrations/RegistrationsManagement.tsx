// درخواست‌های عضویتی که از بات تلگرام می‌آیند.
//
// تصمیم کارفرما (۲۰۲۶-۰۹-۲۲): ثبت‌نام فقط از تلگرام. این صفحه صندوق
// ورودی همان درخواست‌هاست — همان چیزی که ادمین در تلگرام هم با دکمه‌های
// زیر کارت می‌بیند. هر کدام زودتر تصمیم بگیرد، دیگری بسته می‌شود.
//
// نکتهٔ مهم: تأیید از اینجا **مستقیم اجرا نمی‌شود**. ساخت حساب به کلید
// service-role نیاز دارد و آن هرگز به مرورگر نمی‌رود، پس تصمیم صف
// می‌شود و بات ظرف چند ثانیه اجرایش می‌کند — همان الگوی اعلان‌ها.

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Check, X, Clock, AlertTriangle, RefreshCw, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatIsoToJalali } from '@/lib/jalali';
import { toFa } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import { ConfirmDialog } from '@/ui/compounds/ConfirmDialog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Status =
  | 'awaiting_phone' | 'awaiting_first_name' | 'awaiting_last_name'
  | 'awaiting_alias' | 'submitted' | 'approved' | 'rejected';

interface RegistrationRow {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  alias: string | null;
  full_name: string | null;
  referrer_id: string | null;
  status: Status;
  reject_reason: string | null;
  bot_action: 'approve' | 'reject' | null;
  bot_action_error: string | null;
  created_at: string;
  decided_at: string | null;
}

const STATUS_FA: Record<Status, string> = {
  awaiting_phone:      'منتظر شماره',
  awaiting_first_name: 'منتظر نام',
  awaiting_last_name:  'منتظر نام خانوادگی',
  awaiting_alias:      'منتظر نام مستعار',
  submitted:           'منتظر تصمیم شما',
  approved:            'تأیید شده',
  rejected:            'رد شده',
};

const STATUS_COLOR: Record<Status, string> = {
  awaiting_phone:      'var(--text-tertiary)',
  awaiting_first_name: 'var(--text-tertiary)',
  awaiting_last_name:  'var(--text-tertiary)',
  awaiting_alias:      'var(--text-tertiary)',
  submitted:           'var(--semantic-warn)',
  approved:            'var(--semantic-success)',
  rejected:            'var(--semantic-danger)',
};

type Tab = 'pending' | 'incomplete' | 'decided';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending',    label: 'منتظر تصمیم' },
  { key: 'incomplete', label: 'نیمه‌کاره' },
  { key: 'decided',    label: 'تصمیم‌گرفته' },
];

const INCOMPLETE: Status[] = [
  'awaiting_phone', 'awaiting_first_name', 'awaiting_last_name', 'awaiting_alias',
];

export default function RegistrationsManagement() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RegistrationRow | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      const { data, error } = await db
        .from('registration_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setRows(data ?? []);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // بات صف را هر ۲۰ ثانیه خالی می‌کند؛ کمی تندتر از آن سر می‌زنیم تا
  // «در صف» به «تأیید شده» تبدیل شود بی‌آنکه کسی رفرش کند.
  useEffect(() => {
    const t = setInterval(() => { void fetchRows(); }, 15_000);
    return () => clearInterval(t);
  }, [fetchRows]);

  async function decide(row: RegistrationRow, action: 'approve' | 'reject', reason?: string) {
    setBusyId(row.id);
    try {
      const { error } = await db.rpc('queue_registration_decision', {
        p_request_id: row.id,
        p_action:     action,
        p_reason:     reason ?? null,
      });
      if (error) throw error;
      toast.success(
        action === 'approve'
          ? 'تأیید ثبت شد — بات تا چند ثانیهٔ دیگر حساب را می‌سازد و به کاربر خبر می‌دهد.'
          : 'رد ثبت شد — بات به کاربر اطلاع می‌دهد.',
      );
      await fetchRows();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  }

  const visible = rows.filter((r) =>
    tab === 'pending'    ? r.status === 'submitted' :
    tab === 'incomplete' ? INCOMPLETE.includes(r.status) :
                           r.status === 'approved' || r.status === 'rejected',
  );

  const pendingCount = rows.filter((r) => r.status === 'submitted').length;

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            درخواست‌های عضویت
          </h1>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            ثبت‌نام فقط از ربات تلگرام انجام می‌شود. تأیید از اینجا یا از دکمه‌های
            زیر کارتی که ربات برایتان می‌فرستد — هر دو یکی است.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchRows()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={15} />
          تازه‌سازی
        </button>
      </div>

      {/* تب‌ها */}
      <div className="flex gap-1.5">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: on ? 'var(--accent-surface)' : 'var(--bg-overlay)',
                color: on ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              }}
            >
              {t.label}
              {t.key === 'pending' && pendingCount > 0 && (
                <span className="mr-1.5 tabular-nums">({toFa(pendingCount)})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox size={28} />}
          title={
            tab === 'pending'    ? 'درخواست تازه‌ای نیست' :
            tab === 'incomplete' ? 'کسی وسط ثبت‌نام نمانده' :
                                   'هنوز تصمیمی گرفته نشده'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <RequestCard
              key={r.id}
              row={r}
              busy={busyId === r.id}
              onApprove={() => void decide(r, 'approve')}
              onReject={() => setRejecting(r)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={rejecting !== null}
        title="رد درخواست عضویت"
        description={
          rejecting
            ? `درخواست «${rejecting.full_name ?? rejecting.telegram_id}» رد شود؟ ربات به او اطلاع می‌دهد.`
            : ''
        }
        confirmLabel="رد کن"
        variant="danger"
        loading={busyId !== null}
        onConfirm={() => { if (rejecting) void decide(rejecting, 'reject'); }}
        onClose={() => setRejecting(null)}
      />
    </div>
  );
}

// ─── کارت یک درخواست ────────────────────────────────────────────
function RequestCard({
  row, busy, onApprove, onReject,
}: {
  row: RegistrationRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const queued = row.bot_action !== null;
  const canDecide = row.status === 'submitted' && !queued;
  const handle = row.telegram_username ? `@${row.telegram_username}` : null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {row.full_name ?? '— بدون نام —'}
            </span>
            {row.alias && (
              <span
                className="rounded px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: 'var(--accent-wash)', color: 'var(--accent-gold)' }}
              >
                {row.alias}
              </span>
            )}
          </div>

          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums"
            style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}
          >
            {row.phone && <span>📱 {toFa(row.phone)}</span>}
            {/* یوزرنیم لاتین است؛ بدون جداسازی، @ در جریان راست‌به‌چپ
                به آن طرف کلمه می‌پرد و «sina_z@» خوانده می‌شود. */}
            {handle && <span>🔗 <span dir="ltr">{handle}</span></span>}
            <span>🆔 {row.telegram_id}</span>
          </div>

          <div className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            ثبت: {formatIsoToJalali(row.created_at)}
            {row.decided_at && ` · تصمیم: ${formatIsoToJalali(row.decided_at)}`}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              color: STATUS_COLOR[row.status],
              backgroundColor: 'var(--bg-overlay)',
            }}
          >
            {STATUS_FA[row.status]}
          </span>

          {canDecide && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'var(--semantic-success)', color: '#fff' }}
              >
                <Check size={15} />
                تأیید
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onReject}
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: 'var(--semantic-danger)', color: 'var(--semantic-danger)' }}
              >
                <X size={15} />
                رد
              </button>
            </>
          )}
        </div>
      </div>

      {queued && (
        <div
          className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}
        >
          <Clock size={14} />
          {row.bot_action === 'approve' ? 'تأیید' : 'رد'} در صف اجرای ربات است — تا چند ثانیهٔ دیگر.
        </div>
      )}

      {row.bot_action_error && (
        <div
          className="mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'var(--bg-overlay)', color: 'var(--semantic-danger)' }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>اجرای تصمیم شکست خورد: {row.bot_action_error}</span>
        </div>
      )}

      {row.status === 'rejected' && row.reject_reason && (
        <div className="mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          دلیل رد: {row.reject_reason}
        </div>
      )}
    </div>
  );
}
