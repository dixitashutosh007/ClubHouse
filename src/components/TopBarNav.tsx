'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, ChevronDown, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ClubHouseLogo } from '@/components/ClubHouseLogo';
import { NotificationBell } from '@/components/NotificationBell';
import { SuggestChangeButton } from '@/components/SuggestChangeButton';
import { APP_NAME } from '@/lib/brand';
import { Avatar } from '@/components/ui/Avatar';

/** Demo residents to sign in as, in development only */
const DEMO_PERSONAS = [
  { id: 'usr-offerer-001', label: 'Ride offerer' },
  { id: 'usr-seeker-001', label: 'Ride seeker' },
  { id: 'usr-admin-001', label: 'Society admin' },
  { id: 'usr-app-admin-001', label: 'App admin' },
];

/**
 * The app bar: Club House and the society on the left (tap for home),
 * suggestions, notifications and the account menu on the right. With the
 * desktop sidebar (withSidebar, from 1024px) the logo lives in the sidebar.
 */
export function TopBarNav({ withSidebar = false }: { withSidebar?: boolean }) {
  const {
    society,
    societiesList,
    activeSocietyId,
    switchSociety,
    activePersona,
    switchPersona,
    membership,
    user,
    isAuthenticated,
    logout,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!isAuthenticated) return null;

  const isDev = process.env.NODE_ENV !== 'production';
  const isAdmin = membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN';
  const roleLabel =
    membership?.role === 'SUPER_ADMIN' ? 'App admin' : membership?.role === 'SOCIETY_ADMIN' ? 'Society admin' : 'Resident';
  const otherSocieties = societiesList.length > 1;
  const close = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-line">
      <div className={`h-14 lg:h-16 px-4 lg:px-8 flex items-center justify-between gap-3 ${withSidebar ? 'lg:justify-end' : ''}`}>
        <Link
          href="/"
          aria-label={`${APP_NAME} home`}
          className={`flex items-center gap-2.5 min-w-0 min-h-11 ${withSidebar ? 'lg:hidden' : ''}`}
        >
          <span className="w-9 h-9 rounded-control bg-home-deep text-ink-inverse flex items-center justify-center shrink-0">
            <ClubHouseLogo className="w-5 h-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-card font-bold text-ink">{APP_NAME}</span>
            <span className="block text-meta text-ink-muted truncate">{society?.name ?? 'Your society'}</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {membership?.status === 'ACTIVE' && <SuggestChangeButton variant="icon" />}
          <NotificationBell />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label="Account menu"
              className="h-11 pl-1 pr-2 rounded-full border border-line bg-surface hover:bg-sunken flex items-center gap-1.5"
            >
              <Avatar name={user?.fullName} photoUrl={user?.profilePhotoUrl} size={34} />
              <span className="hidden lg:block max-w-40 truncate text-support font-semibold text-ink">
                {user?.fullName?.split(' ')[0]}
              </span>
              <ChevronDown className="w-4 h-4 text-ink-muted" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                id={menuId}
                role="menu"
                className="absolute right-0 mt-2 w-72 bg-surface rounded-card shadow-overlay border border-line p-2 z-50"
              >
                <div className="px-3 py-2.5">
                  <p className="text-support font-bold text-ink truncate">{user?.fullName}</p>
                  <p className="text-meta text-ink-muted truncate">
                    {roleLabel}
                    {membership?.flatNumber ? ` · Flat ${membership.flatNumber}` : ''}
                  </p>
                </div>

                <div className="border-t border-line pt-1">
                  <MenuLink href="/profile" icon={User} label="My profile" onSelect={close} />
                  {isAdmin && <MenuLink href="/admin" icon={ShieldCheck} label="Admin portal" onSelect={close} />}
                </div>

                {otherSocieties && (
                  <div className="border-t border-line mt-1 pt-1">
                    <p className="px-3 pt-1.5 pb-1 text-tag font-semibold uppercase tracking-wider text-ink-muted">Society</p>
                    {societiesList.map((soc) => (
                      <button
                        key={soc.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={soc.id === activeSocietyId}
                        onClick={() => {
                          close();
                          if (soc.id !== activeSocietyId) switchSociety(soc.id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 min-h-11 rounded-control text-left text-support text-ink hover:bg-sunken"
                      >
                        <Building2 className="w-4 h-4 text-ink-muted shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate">{soc.name}</span>
                        {soc.id === activeSocietyId && <Check className="w-4 h-4 text-home-deep" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}

                {isDev && (
                  <div className="border-t border-line mt-1 pt-1">
                    <p className="px-3 pt-1.5 pb-1 text-tag font-semibold uppercase tracking-wider text-ink-muted">
                      Demo user (development only)
                    </p>
                    {DEMO_PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={p.id === activePersona}
                        onClick={() => {
                          close();
                          switchPersona(p.id);
                        }}
                        className="w-full flex items-center justify-between px-3 min-h-11 rounded-control text-left text-support text-ink hover:bg-sunken"
                      >
                        {p.label}
                        {p.id === activePersona && <Check className="w-4 h-4 text-home-deep" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t border-line mt-1 pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      close();
                      await logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 min-h-11 rounded-control text-left text-support font-semibold text-danger hover:bg-danger-bg"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onSelect,
}: {
  href: string;
  icon: typeof User;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 px-3 min-h-11 rounded-control text-support text-ink hover:bg-sunken"
    >
      <Icon className="w-4 h-4 text-ink-muted" aria-hidden="true" />
      {label}
    </Link>
  );
}
