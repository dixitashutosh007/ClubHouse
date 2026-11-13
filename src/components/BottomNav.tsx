'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Car,
  ClipboardList,
  Clock,
  GraduationCap,
  Home,
  LayoutGrid,
  PlusCircle,
  Search,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RIDESHARE_NAME } from '@/lib/brand';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Highlight only on this exact path (module home pages) */
  exact?: boolean;
}

type Module = 'hub' | 'rideshare' | 'classes';

function moduleFor(pathname: string): Module {
  if (pathname === '/rides' || pathname.startsWith('/rides/') || pathname === '/feedback' || pathname === '/report') {
    return 'rideshare';
  }
  if (pathname === '/lessons' || pathname.startsWith('/lessons/')) return 'classes';
  return 'hub';
}

/**
 * The bottom menu follows the module you are in: the Club House home shows
 * the apps, RideShare shows ride actions (by the resident's ride mode), and
 * Classes shows class actions.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { membership, isAuthenticated, user } = useAuth();

  if (!isAuthenticated || membership?.status !== 'ACTIVE') return null;

  const isAdmin = membership.role === 'SOCIETY_ADMIN' || membership.role === 'SUPER_ADMIN';
  const home: NavItem = { label: 'Home', href: '/', icon: Home, exact: true };
  const mode = user?.commuteIntent ?? 'SEEKER';

  const items: Record<Module, NavItem[]> = {
    hub: [
      home,
      { label: RIDESHARE_NAME, href: '/rides', icon: Car },
      { label: 'Classes', href: '/lessons', icon: GraduationCap },
      ...(isAdmin ? [{ label: 'Admin', href: '/admin', icon: ShieldCheck }] : []),
      { label: 'Profile', href: '/profile', icon: User },
    ],
    rideshare: [
      home,
      { label: RIDESHARE_NAME, href: '/rides', icon: LayoutGrid, exact: true },
      ...(mode !== 'OFFERER' ? [{ label: 'Find', href: '/rides/find', icon: Search }] : []),
      ...(mode !== 'SEEKER' ? [{ label: 'Offer', href: '/rides/offer', icon: PlusCircle }] : []),
      mode === 'OFFERER'
        ? { label: 'My rides', href: '/rides/my-rides', icon: Clock }
        : { label: 'Requests', href: '/rides/my-requests', icon: Clock },
    ],
    classes: [
      home,
      { label: 'Classes', href: '/lessons', icon: GraduationCap, exact: true },
      { label: 'Teach', href: '/lessons/create', icon: PlusCircle },
      { label: 'My classes', href: '/lessons/my-listings', icon: ClipboardList },
    ],
  };
  const navItems = items[moduleFor(pathname)];

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                  isActive ? 'text-emerald-800 font-bold' : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
              >
                <span
                  className={`w-12 h-7 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-emerald-100' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
