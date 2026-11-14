'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/components/ui/cn';
import { MODULE_THEMES } from '@/lib/design/modules';
import { bottomNavItems, isActive, isAdminMember, sectionFor, sectionModule } from '@/lib/design/navigation';

/**
 * Phone and tablet tab bar (hidden from 1024px, where the sidebar takes
 * over). It follows the app you are in: Home shows Home, Admin (for admins)
 * and Profile; RideShare and Classes show their own pages. The active tab
 * takes the app's colour.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { membership, isAuthenticated } = useAuth();

  if (!isAuthenticated || membership?.status !== 'ACTIVE') return null;

  const section = sectionFor(pathname);
  const theme = MODULE_THEMES[sectionModule(section)];
  const navItems = bottomNavItems(section, isAdminMember(membership));

  return (
    <nav
      aria-label="Main"
      className="lg:hidden sticky bottom-0 z-40 bg-surface/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around px-2 max-w-2xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item, pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'h-16 flex flex-col items-center justify-center gap-1 text-tag transition-colors',
                  active ? cn(theme.text, 'font-bold') : 'text-ink-muted font-medium hover:text-ink'
                )}
              >
                <span
                  className={cn(
                    'w-14 h-8 rounded-full flex items-center justify-center transition-colors',
                    active && theme.tint
                  )}
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
