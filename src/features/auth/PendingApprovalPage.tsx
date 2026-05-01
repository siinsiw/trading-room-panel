import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useRealtime } from '@/hooks/useRealtime';
import type { Profile } from '@/lib/database.types';

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const profileId = profile?.id;

  // Subscribe to profile changes so we auto-redirect when active becomes true.
  // Only subscribe when we have a profile id — use a fixed fallback table
  // that won't match anything when profileId is undefined.
  useRealtime<Record<string, unknown>>(
    {
      table: 'profiles',
      event: 'UPDATE',
      filter: profileId
        ? { column: 'id', value: profileId }
        : { column: 'id', value: '__none__' },
    },
    async (payload) => {
      const newRecord = payload.new as Partial<Profile> | undefined;
      if (newRecord?.active === true) {
        // Reload profile into store then redirect
        await useAuthStore.getState().loadProfile();
        navigate('/trader/orderbook', { replace: true });
      }
    },
    [profileId],
  );

  // Also check on mount: if profile is already active, redirect immediately
  useEffect(() => {
    if (profile?.active) {
      navigate('/trader/orderbook', { replace: true });
    }
  }, [profile?.active, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="text-center">
      {/* Clock icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{
          backgroundColor: 'rgba(212,162,76,0.12)',
          border: '1px solid rgba(212,162,76,0.25)',
        }}
      >
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent-gold)' }}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        در انتظار تأیید ادمین
      </h1>

      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
        حساب شما در انتظار تأیید ادمین است.
        <br />
        پس از تأیید، به‌صورت خودکار وارد می‌شوید.
      </p>

      {profile?.full_name && (
        <p
          className="text-sm mb-5 rounded-lg px-3 py-1.5 inline-block"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-overlay)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {profile.full_name}
        </p>
      )}

      {/* Live waiting indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <span
          className="inline-block w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: 'var(--accent-gold)' }}
        />
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          در حال انتظار برای تأیید…
        </span>
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="text-sm hover:underline transition-colors"
        style={{ color: 'var(--semantic-danger)' }}
      >
        خروج از حساب
      </button>
    </div>
  );
}
