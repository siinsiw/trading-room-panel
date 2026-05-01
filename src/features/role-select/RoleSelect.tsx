import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

// This page is no longer the primary entry point.
// Users are redirected to /auth/login for proper Supabase auth.
export default function RoleSelect() {
  const navigate = useNavigate();
  const { profile, initialized, loading, loadProfile } = useAuthStore();

  useEffect(() => {
    if (!initialized) loadProfile();
  }, [initialized, loadProfile]);

  useEffect(() => {
    if (!initialized || loading) return;
    if (!profile) {
      navigate('/auth/login', { replace: true });
      return;
    }
    if (!profile.active && profile.role === 'trader') {
      navigate('/auth/pending-approval', { replace: true });
      return;
    }
    const dest =
      profile.role === 'admin'      ? '/admin/dashboard'      :
      profile.role === 'accountant' ? '/accountant/reports'   :
                                      '/trader/orderbook';
    navigate(dest, { replace: true });
  }, [profile, initialized, loading, navigate]);

  return (
    <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent-gold)', borderTopColor: 'transparent' }} />
    </div>
  );
}
