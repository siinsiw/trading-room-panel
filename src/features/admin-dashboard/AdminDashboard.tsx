import { useTimeStore } from '@/stores/time.store';
import { toFa } from '@/lib/persian';

export default function AdminDashboard() {
  const { tick, isLocked, lockCountdown } = useTimeStore();

  const hours   = Math.floor(lockCountdown / 3600);
  const minutes = Math.floor((lockCountdown % 3600) / 60);
  const seconds = lockCountdown % 60;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>داشبورد</h1>
        <div className="flex items-center gap-3">
          <span className="tabular text-2xl font-medium" style={{ color: 'var(--accent-gold)' }}>
            {tick ? toFa(tick.tehranTime) : '––:––:––'}
          </span>
          <span className="px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: isLocked ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: isLocked ? 'var(--semantic-danger)' : 'var(--semantic-success)',
            }}>
            {isLocked ? 'قفل شده' : 'باز'}
          </span>
        </div>
      </div>

      {!isLocked && lockCountdown > 0 && (
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', border: '1px solid' }}>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>زمان تا قفل ۱۳:۳۰</p>
          <p className="tabular text-3xl font-bold" style={{ color: 'var(--accent-gold-bright)' }}>
            {toFa(`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`)}
          </p>
        </div>
      )}

      {/* KPI Cards placeholder */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['تریدرهای فعال', 'حجم امروز', 'سفارش‌های باز', 'ریسک مارجین'].map(label => (
          <div key={label} className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className="tabular text-xl font-bold" style={{ color: 'var(--text-primary)' }}>—</p>
          </div>
        ))}
      </div>

      {/* Order book widget & risk panel will be wired in next phase */}
      <div className="rounded-xl p-6 text-center text-sm" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
        ویجت‌های داشبورد در مرحله بعد سیم‌کشی می‌شوند
      </div>
    </div>
  );
}
