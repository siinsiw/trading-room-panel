import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

export function AuthGuard() {
  const { profile, loading, initialized, loadProfile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) loadProfile();
  }, [initialized, loadProfile]);

  useEffect(() => {
    if (!initialized || loading) return;
    if (!profile) { navigate('/auth/login', { replace: true }); return; }
    if (!profile.active && profile.role === 'trader') {
      navigate('/auth/pending-approval', { replace: true });
    }
  }, [profile, loading, initialized, navigate]);

  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent-gold)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!profile) return null;

  return <Outlet />;
}
