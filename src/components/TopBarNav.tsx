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
 * notifications and the account menu on the right.
 */
export function TopBarNav() {
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="h-14 px-4 flex items-center justify-between gap-3">
        <Link href="/" aria-label={`${APP_NAME} home`} className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <ClubHouseLogo className="w-5 h-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[15px] font-extrabold tracking-tight text-slate-900">{APP_NAME}</span>
            <span className="block text-[11px] font-medium text-slate-600 truncate">
              {society?.name ?? 'Your society'}
            </span>
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
              className="h-10 pl-1 pr-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1"
            >
              <Avatar name={user?.fullName} photoUrl={user?.profilePhotoUrl} size={32} />
              <ChevronDown className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                id={menuId}
                role="menu"
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50"
              >
                <div className="px-3 py-2.5">
                  <p className="text-sm font-bold text-slate-900 truncate">{user?.fullName}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {roleLabel}
                    {membership?.flatNumber ? ` · Flat ${membership.flatNumber}` : ''}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <MenuLink href="/profile" icon={User} label="My profile" onSelect={close} />
                  {isAdmin && <MenuLink href="/admin" icon={ShieldCheck} label="Admin portal" onSelect={close} />}
                </div>

                {otherSocieties && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <p className="px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">Society</p>
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm text-slate-800 hover:bg-slate-50"
                      >
                        <Building2 className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate">{soc.name}</span>
                        {soc.id === activeSocietyId && <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}

                {isDev && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <p className="px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
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
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm text-slate-800 hover:bg-slate-50"
                      >
                        {p.label}
                        {p.id === activePersona && <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      close();
                      await logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
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
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-800 hover:bg-slate-50"
    >
      <Icon className="w-4 h-4 text-slate-600" aria-hidden="true" />
      {label}
    </Link>
  );
}
