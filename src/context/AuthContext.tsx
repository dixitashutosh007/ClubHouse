'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, Society, SocietyMembership, SocietySummary } from '@/types';
import { apiFetch, getDevPersona, selectSociety, setDevPersona } from '@/lib/api-client';
import { disablePush } from '@/lib/firebase/push';

interface AuthContextType {
  user: User | null;
  society: Society | null;
  societiesList: SocietySummary[];
  membership: SocietyMembership | null;
  /** Development only: the demo user requests act as */
  activePersona: string;
  activeSocietyId: string;
  isAuthenticated: boolean;
  switchPersona: (userId: string) => void;
  switchSociety: (societyId: string) => void;
  updateCommuteIntent: (intent: 'OFFERER' | 'SEEKER' | 'BOTH') => Promise<void>;
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  society: null,
  societiesList: [],
  membership: null,
  activePersona: '',
  activeSocietyId: '',
  isAuthenticated: false,
  switchPersona: () => {},
  switchSociety: () => {},
  updateCommuteIntent: async () => {},
  isLoading: true,
  refreshAuth: async () => {},
  logout: async () => {},
});

// Development only: after "Sign out", stop auto-signing in as the demo persona
const LOGGED_OUT_KEY = 'junto_logged_out';

function readLoggedOutFlag(): boolean {
  try {
    return localStorage.getItem(LOGGED_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

interface SessionState {
  user: User | null;
  society: Society | null;
  membership: SocietyMembership | null;
  societiesList: SocietySummary[];
}

const SIGNED_OUT: SessionState = { user: null, society: null, membership: null, societiesList: [] };

async function loadSession(): Promise<SessionState> {
  const [meRes, societiesRes] = await Promise.all([
    apiFetch('/api/v1/auth/me'),
    apiFetch('/api/v1/societies'),
  ]);
  if (!meRes.ok) return SIGNED_OUT;

  const me = await meRes.json();
  const societies = societiesRes.ok ? await societiesRes.json() : { societies: [] };
  return {
    user: me.user,
    society: me.society,
    membership: me.membership,
    societiesList: societies.societies ?? [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activePersona, setActivePersona] = useState<string>('');
  const [session, setSession] = useState<SessionState>(SIGNED_OUT);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAuth = useCallback(async () => {
    if (process.env.NODE_ENV !== 'production' && readLoggedOutFlag()) {
      setSession(SIGNED_OUT);
      setIsLoading(false);
      return;
    }
    try {
      setSession(await loadSession());
    } catch (e) {
      console.error('Failed to load user', e);
      setSession(SIGNED_OUT);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load once mounted (browser APIs are needed for the dev persona)
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (process.env.NODE_ENV !== 'production') setActivePersona(getDevPersona());
      return refreshAuth();
    });
    return () => {
      cancelled = true;
    };
  }, [refreshAuth]);

  const switchPersona = (userId: string) => {
    setDevPersona(userId);
    setActivePersona(userId);
    void refreshAuth();
  };

  const switchSociety = (societyId: string) => {
    selectSociety(societyId);
    // Reload so every screen refetches its data for the new society
    window.location.reload();
  };

  const updateCommuteIntent = async (intent: 'OFFERER' | 'SEEKER' | 'BOTH') => {
    if (!session.user) return;
    const res = await apiFetch('/api/v1/auth/me', { method: 'PUT', json: { commuteIntent: intent } });
    if (res.ok) {
      const data = await res.json();
      setSession((s) => ({ ...s, user: data.user }));
    }
  };

  const logout = async () => {
    // Stop push for this resident on this browser while still signed in
    await disablePush();
    try {
      await apiFetch('/api/v1/auth/session', { method: 'DELETE' });
    } catch (e) {
      console.warn('Logout request failed:', e);
    }
    try {
      localStorage.setItem(LOGGED_OUT_KEY, 'true');
    } catch {
      // ignore
    }
    setSession(SIGNED_OUT);
  };

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        society: session.society,
        societiesList: session.societiesList,
        membership: session.membership,
        activePersona,
        activeSocietyId: session.society?.id ?? '',
        isAuthenticated: Boolean(session.user),
        switchPersona,
        switchSociety,
        updateCommuteIntent,
        isLoading,
        refreshAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Clears the development "signed out" flag after a successful sign-in */
export function clearLoggedOutFlag(): void {
  try {
    localStorage.removeItem(LOGGED_OUT_KEY);
  } catch {
    // ignore
  }
}

export function useAuth() {
  return useContext(AuthContext);
}
