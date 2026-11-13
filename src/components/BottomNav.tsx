'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  Clock,
  GraduationCap,
  Home,
  LayoutGrid,
  PlusCircle,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
 * Home, Profile and (for admins) Admin; RideShare shows Rides, Offer and
 * My rides; Classes shows class actions.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { membership, isAuthenticated } = useAuth();

  if (!isAuthenticated || membership?.status !== 'ACTIVE') return null;

  const isAdmin = membership.role === 'SOCIETY_ADMIN' || membership.role === 'SUPER_ADMIN';
  const home: NavItem = { label: 'Home', href: '/', icon: Home, exact: true };

  const items: Record<Module, NavItem[]> = {
    // Apps are on the Home screen itself; the bar holds your settings (and admin, for admins)
    hub: [
      home,
      ...(isAdmin ? [{ label: 'Admin', href: '/admin', icon: ShieldCheck }] : []),
      { label: 'Profile', href: '/profile', icon: User },
    ],
    // The same for everyone: find a ride on the RideShare page, offer one, or manage your own
    rideshare: [
      home,
      { label: 'Rides', href: '/rides', icon: LayoutGrid, exact: true },
      { label: 'Offer', href: '/rides/offer', icon: PlusCircle },
      { label: 'My rides', href: '/rides/my-rides', icon: Clock },
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
