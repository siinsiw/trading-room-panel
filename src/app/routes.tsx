import type { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ResponsiveShell } from '@/ui/layouts/ResponsiveShell';
import { AuthShell } from '@/ui/layouts/AuthShell';
import { AuthGuard } from '@/ui/guards/AuthGuard';
import { RoleGuard } from '@/ui/guards/RoleGuard';

const RoleSelect = lazy(() => import('@/features/role-select/RoleSelect'));

// Auth
const LoginPage           = lazy(() => import('@/features/auth/LoginPage'));
const ForgotPasswordPage  = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage   = lazy(() => import('@/features/auth/ResetPasswordPage'));
const VerifyEmailPage     = lazy(() => import('@/features/auth/VerifyEmailPage'));
const PendingApprovalPage = lazy(() => import('@/features/auth/PendingApprovalPage'));
const TelegramOnlyPage    = lazy(() => import('@/features/auth/TelegramOnlyPage'));

// Admin
const AdminDashboard    = lazy(() => import('@/features/admin-dashboard/AdminDashboard'));
const MarketsManagement = lazy(() => import('@/features/markets-management/MarketsManagement'));
const UsersManagement   = lazy(() => import('@/features/users-management/UsersManagement'));
const SettlementControl = lazy(() => import('@/features/settlement-control/SettlementControl'));
const AdminTradesList   = lazy(() => import('@/features/trades-list/TradesList'));
const ManualTradeEntry  = lazy(() => import('@/features/manual-trade/ManualTradeEntry'));
const HolidaysManagement = lazy(() => import('@/features/holidays-management/HolidaysManagement'));
const RoomSettings      = lazy(() => import('@/features/room-settings/RoomSettings'));
const Registrations     = lazy(() => import('@/features/registrations/RegistrationsManagement'));

// Accountant
const AccountantReports     = lazy(() => import('@/features/accountant-reports/AccountantReports'));
const AccountantTrades      = lazy(() => import('@/features/accountant-trades/AccountantTrades'));
const AccountantSettlements = lazy(() => import('@/features/accountant-settlements/AccountantSettlements'));
const AccountantUsers       = lazy(() => import('@/features/accountant-users/AccountantUsers'));

// Shared (همه‌ی نقش‌ها)
const MyProfilePage = lazy(() => import('@/features/profile/MyProfilePage'));

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-[var(--text-secondary)]">در حال بارگذاری...</div>}>
      {children}
    </Suspense>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Wrap><RoleSelect /></Wrap> },

  // Auth routes — no guard needed
  {
    element: <AuthShell />,
    children: [
      { path: '/auth/login',            element: <Wrap><LoginPage /></Wrap> },
      { path: '/auth/forgot-password',  element: <Wrap><ForgotPasswordPage /></Wrap> },
      { path: '/auth/reset-password',   element: <Wrap><ResetPasswordPage /></Wrap> },
      { path: '/auth/verify-email',     element: <Wrap><VerifyEmailPage /></Wrap> },
      { path: '/auth/pending-approval', element: <Wrap><PendingApprovalPage /></Wrap> },
      // معامله‌گر اگر به هر دلیلی وارد شود، اینجا می‌رسد و نشستش بسته می‌شود
      { path: '/auth/telegram-only',    element: <Wrap><TelegramOnlyPage /></Wrap> },
    ],
  },

  // Protected routes — must be authenticated
  {
    element: <AuthGuard />,
    children: [
      {
        element: <ResponsiveShell />,
        children: [
          // مسیر مشترک — برای همه‌ی نقش‌های احراز شده
          { path: '/profile', element: <Wrap><MyProfilePage /></Wrap> },

          // Admin only
          {
            element: <RoleGuard roles={['admin']} />,
            children: [
              { path: '/admin/dashboard',     element: <Wrap><AdminDashboard /></Wrap> },
              { path: '/admin/markets',       element: <Wrap><MarketsManagement /></Wrap> },
              { path: '/admin/users',         element: <Wrap><UsersManagement /></Wrap> },
              { path: '/admin/settlement',    element: <Wrap><SettlementControl /></Wrap> },
              { path: '/admin/trades',        element: <Wrap><AdminTradesList /></Wrap> },
              { path: '/admin/manual-trade',  element: <Wrap><ManualTradeEntry /></Wrap> },
              { path: '/admin/holidays',      element: <Wrap><HolidaysManagement /></Wrap> },
              { path: '/admin/registrations', element: <Wrap><Registrations /></Wrap> },
              { path: '/admin/settings',      element: <Wrap><RoomSettings /></Wrap> },
              { path: '/admin/profile',       element: <Wrap><MyProfilePage /></Wrap> },
            ],
          },

          // مسیرهای معامله‌گر از پنل برداشته شدند (۲۰۲۶-۰۹-۲۲).
          // معامله فقط در گروه تلگرام انجام می‌شود و پنل داشبورد
          // مدیریتی است. فایل‌های features/trader-* روی دیسک مانده‌اند
          // ولی به هیچ مسیری وصل نیستند.

          // Accountant only
          {
            element: <RoleGuard roles={['accountant']} />,
            children: [
              { path: '/accountant/reports',     element: <Wrap><AccountantReports /></Wrap> },
              { path: '/accountant/trades',      element: <Wrap><AccountantTrades /></Wrap> },
              { path: '/accountant/settlements', element: <Wrap><AccountantSettlements /></Wrap> },
              { path: '/accountant/users',       element: <Wrap><AccountantUsers /></Wrap> },
              { path: '/accountant/profile',     element: <Wrap><MyProfilePage /></Wrap> },
            ],
          },
        ],
      },
    ],
  },
];
