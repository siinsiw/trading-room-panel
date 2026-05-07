import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Trash2, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatIsoToJalali } from '@/lib/jalali';
import { toFa } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import { ConfirmDialog } from '@/ui/compounds/ConfirmDialog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Holiday {
  date: string;          // YYYY-MM-DD
  description: string;
  created_at: string;
  created_by: string | null;
}

function todayISO(): string {
  // YYYY-MM-DD به وقت تهران
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

export default function HolidaysManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [newDate, setNewDate] = useState(todayISO());
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState<string | null>(null);
  const [shifting, setShifting] = useState(false);

  const fetchHolidays = useCallback(async () => {
    try {
      const { data, error } = await db
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      setHolidays(data ?? []);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  async function handleAdd() {
    if (!newDate) { toast.error('تاریخ را وارد کنید'); return; }
    setSaving(true);
    try {
      const { error } = await db
        .from('holidays')
        .insert({ date: newDate, description: newDesc || '' });
      if (error) throw error;
      toast.success('روز تعطیل اضافه شد');
      setShowAdd(false);
      setNewDate(todayISO());
      setNewDesc('');
      fetchHolidays();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteDate) return;
    try {
      const { error } = await db.from('holidays').delete().eq('date', deleteDate);
      if (error) throw error;
      toast.success('روز تعطیل حذف شد');
      fetchHolidays();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setDeleteDate(null);
    }
  }

  async function handleShift() {
    if (!shiftDate) return;
    setShifting(true);
    try {
      const { data, error } = await db.rpc('shift_settlements_for_holiday', { p_date: shiftDate });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const orders = row?.orders_shifted ?? 0;
      const trades = row?.trades_shifted ?? 0;
      toast.success(`${toFa(orders)} لفظ و ${toFa(trades)} معامله به روز کاری بعد منتقل شد`);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setShifting(false);
      setShiftDate(null);
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            تعطیلات بازار
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            جمعه‌ها به‌صورت پیش‌فرض تعطیل هستند. تاریخ‌های اضافی را اینجا اضافه کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
        >
          <CalendarPlus size={16} />
          افزودن روز تعطیل
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      ) : holidays.length === 0 ? (
        <EmptyState
          title="روز تعطیلی ثبت نشده"
          action={{ label: 'افزودن روز تعطیل', onClick: () => setShowAdd(true) }}
        />
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                {['تاریخ شمسی', 'تاریخ میلادی', 'توضیح', 'ثبت در', 'عملیات'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-medium whitespace-nowrap"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holidays.map((hol) => (
                <tr
                  key={hol.date}
                  className="border-t hover:bg-white/5"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td
                    className="px-4 py-3 tabular-nums font-medium"
                    style={{ color: 'var(--accent-gold)', fontFamily: "'Geist Mono', monospace" }}
                  >
                    {formatIsoToJalali(hol.date)}
                  </td>
                  <td
                    className="px-4 py-3 tabular-nums"
                    style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}
                  >
                    {toFa(hol.date)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {hol.description || '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-xs tabular-nums"
                    style={{ color: 'var(--text-tertiary)', fontFamily: "'Geist Mono', monospace" }}
                  >
                    {formatIsoToJalali(hol.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShiftDate(hol.date)}
                        title="انتقال لفظ‌ها و معاملات این تاریخ به روز کاری بعد"
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10"
                        style={{ color: 'var(--accent-gold)' }}
                      >
                        <ArrowLeftRight size={13} />
                        انتقال
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteDate(hol.date)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10"
                        style={{ color: 'var(--semantic-danger)' }}
                      >
                        <Trash2 size={13} />
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              افزودن روز تعطیل
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  تاریخ (میلادی)
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Geist Mono', monospace",
                    colorScheme: 'dark',
                  }}
                />
                {newDate && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    معادل شمسی: {formatIsoToJalali(newDate)}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>
                  توضیح (اختیاری)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="عید فطر"
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={saving}
                className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
              >
                {saving ? 'در حال ذخیره...' : 'افزودن'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteDate}
        onClose={() => setDeleteDate(null)}
        onConfirm={handleDelete}
        title="حذف روز تعطیل"
        description={`آیا مطمئنید می‌خواهید ${deleteDate ? formatIsoToJalali(deleteDate) : ''} را از لیست تعطیلات حذف کنید؟`}
        confirmLabel="حذف"
        variant="danger"
      />

      <ConfirmDialog
        open={!!shiftDate}
        onClose={() => setShiftDate(null)}
        onConfirm={handleShift}
        title="انتقال تصفیه‌ها"
        description={
          shiftDate
            ? `تمام لفظ‌ها و معاملاتی که تاریخ تصفیه‌شان ${formatIsoToJalali(shiftDate)} است به اولین روز کاری بعد منتقل می‌شوند. ادامه می‌دهید؟`
            : ''
        }
        confirmLabel={shifting ? 'در حال انتقال...' : 'انتقال'}
      />
    </div>
  );
}
