'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ClubHouseLogo } from '@/components/ClubHouseLogo';
import { cn } from '@/components/ui/cn';
import { APP_NAME } from '@/lib/brand';
import { MODULE_THEMES, type ModuleTheme } from '@/lib/design/modules';
import { isActive, isAdminMember, sectionFor, sidebarModel, type NavItem } from '@/lib/design/navigation';

/**
 * Desktop sidebar (from 1024px): Home, every app (Coming soon apps are
 * labelled and not links), the current app's pages, Profile, and Admin for
 * admins only.
 */
export function SideNav() {
  const pathname = usePathname();
  const { society, membership } = useAuth();
  const model = sidebarModel(isAdminMember(membership));
  const section = sectionFor(pathname);

  return (
    <aside className="hidden lg:flex flex-col sticky top-0 h-dvh w-64 shrink-0 border-r border-line bg-surface">
      <Link href="/" className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-line" aria-label={`${APP_NAME} home`}>
        <span className="w-9 h-9 rounded-control bg-home-deep text-ink-inverse flex items-center justify-center shrink-0">
          <ClubHouseLogo className="w-5 h-5" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-card font-bold text-ink">{APP_NAME}</span>
          <span className="block text-meta text-ink-muted truncate">{society?.name ?? 'Your society'}</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4 grid content-start gap-5">
        <NavGroup>
          {model.main.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item, pathname)} theme={MODULE_THEMES.home} />
          ))}
        </NavGroup>

        <NavGroup label="Apps">
          {model.apps.map(({ module, pages }) => {
            const Icon = module.icon;
            if (module.status !== 'live' || !module.href) {
              return (
                <li key={module.id}>
                  <span className="flex items-center gap-3 px-3 h-10 rounded-control text-support text-ink-muted">
                    <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', module.theme.fill.split(' ')[0])} aria-hidden="true" />
                    <span className="flex-1 truncate">{module.name}</span>
                    <span className="text-tag font-semibold bg-sunken px-2 py-0.5 rounded-full">Soon</span>
                  </span>
                </li>
              );
            }
            const inside = section === module.id;
            return (
              <li key={module.id} className="grid gap-0.5">
                <Link
                  href={module.href}
                  aria-current={inside && pathname === module.href ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 h-11 rounded-control text-support font-semibold transition-colors',
                    inside ? module.theme.selected : 'text-ink hover:bg-sunken'
                  )}
                >
                  <Icon className={cn('w-5 h-5 shrink-0', inside ? '' : module.theme.text)} aria-hidden="true" />
                  {module.name}
                </Link>
                {inside && pages.length > 0 && (
                  <ul className="grid gap-0.5 pl-6">
                    {pages.map((page) => {
                      const active = isActive(page, pathname);
                      return (
                        <li key={page.href}>
                          <Link
                            href={page.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2.5 px-3 h-10 rounded-control text-support transition-colors border-l-2',
                              active
                                ? cn(module.theme.text, module.theme.border, 'font-semibold bg-sunken/60')
                                : 'border-transparent text-ink-muted hover:text-ink hover:bg-sunken'
                            )}
                          >
                            {page.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </NavGroup>

        <NavGroup label="You">
          {model.personal.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item, pathname)} theme={MODULE_THEMES.home} />
          ))}
        </NavGroup>

        {model.admin.length > 0 && (
          <NavGroup label="Administration">
            {model.admin.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item, pathname)} theme={MODULE_THEMES.home} />
            ))}
          </NavGroup>
        )}
      </nav>
    </aside>
  );
}

function NavGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      {label && <p className="px-3 text-tag font-semibold uppercase tracking-wider text-ink-muted">{label}</p>}
      <ul className="grid gap-0.5">{children}</ul>
    </div>
  );
}

function NavLink({ item, active, theme }: { item: NavItem; active: boolean; theme: ModuleTheme }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-3 h-11 rounded-control text-support font-semibold transition-colors',
          active ? theme.selected : 'text-ink hover:bg-sunken'
        )}
      >
        <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
        {item.label}
      </Link>
    </li>
  );
}
