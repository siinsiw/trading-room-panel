import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { toFa, formatTether } from '@/lib/persian';
import { parseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { SkeletonCard } from '@/ui/compounds/LoadingSkeleton';
import { EmptyState } from '@/ui/compounds/EmptyState';
import type { Profile } from '@/lib/database.types';
import { Search } from 'lucide-react';

function roleFa(role: string): string {
  const map: Record<string, string> = { admin: 'ادمین', accountant: 'حسابدار', trader: 'تریدر' };
  return map[role] ?? role;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    admin: { bg: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)', text: 'var(--accent-gold)' },
    accountant: { bg: 'color-mix(in srgb, var(--semantic-buy) 12%, transparent)', text: 'var(--semantic-buy)' },
    trader: { bg: 'color-mix(in srgb, var(--text-secondary) 12%, transparent)', text: 'var(--text-secondary)' },
  };
  const c = colors[role] ?? colors.trader;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
      {roleFa(role)}
    </span>
  );
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('');
}

export default function AccountantUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProfiles((data as Profile[]) ?? []);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.phone.includes(q);
  });

  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>کاربران</h1>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو بر اساس نام یا موبایل..."
          className="w-full rounded-lg border bg-transparent py-2 pr-9 pl-3 text-sm outline-none"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      {loading ? (
        <SkeletonCard lines={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title="کاربری یافت نشد" />
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  {['نام', 'موبایل', 'نقش', 'وضعیت', 'ودیعه', 'تاریخ ثبت'].map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--accent-gold) 12%, transparent)', color: 'var(--accent-gold)' }}
                        >
                          {initials(p.full_name)}
                        </div>
                        <span style={{ color: 'var(--text-primary)' }}>{p.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                      {toFa(p.phone)}
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={p.role} /></td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={
                          p.active
                            ? { backgroundColor: 'color-mix(in srgb, var(--semantic-success) 12%, transparent)', color: 'var(--semantic-success)' }
                            : { backgroundColor: 'color-mix(in srgb, var(--semantic-danger) 12%, transparent)', color: 'var(--semantic-danger)' }
                        }
                      >
                        {p.active ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {p.deposit_tether != null ? formatTether(p.deposit_tether) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {toFa(new Date(p.created_at).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
