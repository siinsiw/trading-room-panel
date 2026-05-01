import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import type { Profile } from '@/lib/database.types';

const DEFAULT_ROUTE: Record<Profile['role'], string> = {
  admin:      '/admin/dashboard',
  accountant: '/accountant/reports',
  trader:     '/trader/orderbook',
};

interface Props { roles: Profile['role'][] }

export function RoleGuard({ roles }: Props) {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    if (!roles.includes(profile.role)) {
      navigate(DEFAULT_ROUTE[profile.role], { replace: true });
    }
  }, [profile, roles, navigate]);

  if (!profile || !roles.includes(profile.role)) return null;

  return <Outlet />;
}
