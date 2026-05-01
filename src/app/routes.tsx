import type { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ResponsiveShell } from '@/ui/layouts/ResponsiveShell';

const RoleSelect = lazy(() => import('@/features/role-select/RoleSelect'));

// Admin
const AdminDashboard    = lazy(() => import('@/features/admin-dashboard/AdminDashboard'));
const MarketsManagement = lazy(() => import('@/features/markets-management/MarketsManagement'));
const UsersManagement   = lazy(() => import('@/features/users-management/UsersManagement'));
const SettlementControl = lazy(() => import('@/features/settlement-control/SettlementControl'));
const AdminTradesList   = lazy(() => import('@/features/trades-list/TradesList'));

// Trader
const TraderOrderbook = lazy(() => import('@/features/trader-orderbook/TraderOrderbook'));
const TraderOrders    = lazy(() => import('@/features/trader-orders/TraderOrders'));
const TraderHistory   = lazy(() => import('@/features/trader-history/TraderHistory'));
const TraderProfile   = lazy(() => import('@/features/trader-profile/TraderProfile'));

// Accountant
const AccountantReports     = lazy(() => import('@/features/accountant-reports/AccountantReports'));
const AccountantTrades      = lazy(() => import('@/features/accountant-trades/AccountantTrades'));
const AccountantSettlements = lazy(() => import('@/features/accountant-settlements/AccountantSettlements'));
const AccountantUsers       = lazy(() => import('@/features/accountant-users/AccountantUsers'));

function Wrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="flex h-screen items-center justify-center text-[var(--text-secondary)]">در حال بارگذاری...</div>}>{children}</Suspense>;
}

export const routes: RouteObject[] = [
  { path: '/', element: <Wrap><RoleSelect /></Wrap> },
  {
    element: <ResponsiveShell />,
    children: [
      { path: '/admin/dashboard',  element: <Wrap><AdminDashboard /></Wrap> },
      { path: '/admin/markets',    element: <Wrap><MarketsManagement /></Wrap> },
      { path: '/admin/users',      element: <Wrap><UsersManagement /></Wrap> },
      { path: '/admin/settlement', element: <Wrap><SettlementControl /></Wrap> },
      { path: '/admin/trades',     element: <Wrap><AdminTradesList /></Wrap> },

      { path: '/trader/orderbook', element: <Wrap><TraderOrderbook /></Wrap> },
      { path: '/trader/orders',    element: <Wrap><TraderOrders /></Wrap> },
      { path: '/trader/history',   element: <Wrap><TraderHistory /></Wrap> },
      { path: '/trader/profile',   element: <Wrap><TraderProfile /></Wrap> },

      { path: '/accountant/reports',     element: <Wrap><AccountantReports /></Wrap> },
      { path: '/accountant/trades',      element: <Wrap><AccountantTrades /></Wrap> },
      { path: '/accountant/settlements', element: <Wrap><AccountantSettlements /></Wrap> },
      { path: '/accountant/users',       element: <Wrap><AccountantUsers /></Wrap> },
    ],
  },
];
