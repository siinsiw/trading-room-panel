import {
  BookOpen, CalendarOff, FileCheck, LayoutDashboard, ListOrdered, CirclePlus,
  SlidersHorizontal, TrendingUp, User, UserPlus, Users, BarChart3,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/hooks/useRealtime';

export interface NavItem {
  /** برچسب کوتاه زیر آیکون ریل */
  label: string;
  /** نام کامل — در جستجو و عنوان صفحه */
  full: string;
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: 'registrations';
}

export interface NavGroup { title: string; items: NavItem[] }

// گروه‌بندی بر اساس «کِی سراغش می‌روم»، نه حروف الفبا — ادمین گم نشود
const ADMIN: NavGroup[] = [
  {
    title: 'روزانه',
    items: [
      { label: 'داشبورد', full: 'داشبورد', to: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'تصفیه', full: 'تصفیه', to: '/admin/settlement', icon: FileCheck },
      { label: 'معاملات', full: 'لیست معاملات', to: '/admin/trades', icon: ListOrdered },
      { label: 'ثبت دستی', full: 'ثبت دستی معامله', to: '/admin/manual-trade', icon: CirclePlus },
    ],
  },
  {
    title: 'اعضا',
    items: [
      { label: 'کاربران', full: 'کاربران', to: '/admin/users', icon: Users },
      { label: 'عضویت', full: 'درخواست عضویت', to: '/admin/registrations', icon: UserPlus, badge: 'registrations' },
    ],
  },
  {
    title: 'اتاق',
    items: [
      { label: 'بازارها', full: 'بازارها و مزنه', to: '/admin/markets', icon: TrendingUp },
      { label: 'تعطیلات', full: 'تعطیلات بازار', to: '/admin/holidays', icon: CalendarOff },
      { label: 'تنظیمات', full: 'تنظیمات اتاق', to: '/admin/settings', icon: SlidersHorizontal },
    ],
  },
];

const ACCOUNTANT: NavGroup[] = [
  {
    title: 'حسابداری',
    items: [
      { label: 'گزارش', full: 'گزارش', to: '/accountant/reports', icon: BarChart3 },
      { label: 'معاملات', full: 'معاملات', to: '/accountant/trades', icon: ListOrdered },
      { label: 'تصفیه‌ها', full: 'تصفیه‌ها', to: '/accountant/settlements', icon: FileCheck },
      { label: 'کاربران', full: 'کاربران', to: '/accountant/users', icon: Users },
    ],
  },
];

export function navForRole(role: string | null | undefined): NavGroup[] {
  if (role === 'admin') return ADMIN;
  if (role === 'accountant') return ACCOUNTANT;
  return [];
}

export function guidePath(role: string | null | undefined): string {
  return role === 'accountant' ? '/accountant/guide' : '/admin/guide';
}

export function profilePath(role: string | null | undefined): string {
  return role === 'accountant' ? '/accountant/profile' : '/admin/profile';
}

/** آیتم‌های جانبی که در ریل نیستند ولی در جستجو باید پیدا شوند */
export function extraItems(role: string | null | undefined): NavItem[] {
  return [
    { label: 'راهنما', full: 'راهنما — همهٔ کارها قدم‌به‌قدم', to: guidePath(role), icon: BookOpen },
    { label: 'پروفایل', full: 'پروفایل من و تغییر رمز', to: profilePath(role), icon: User },
  ];
}

/** تعداد درخواست‌های عضویت منتظر تصمیم — برای نشان روی ریل */
export function usePendingRegistrations(enabled: boolean): number {
  const [n, setN] = useState(0);
  const load = () => {
    if (!enabled) return;
    void supabase
      .from('registration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .then(({ count }) => setN(count ?? 0));
  };
  useEffect(load, [enabled]);
  useRealtime({ table: 'registration_requests' }, load, [enabled]);
  return n;
}
