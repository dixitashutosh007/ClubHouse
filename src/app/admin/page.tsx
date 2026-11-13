'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, GraduationCap, History, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { AdminPermissions } from '@/types';
import { ActivityLogTab } from './_components/ActivityLogTab';
import { InviteCard } from './_components/InviteCard';
import { LessonsTab } from './_components/LessonsTab';
import { MembersTab } from './_components/MembersTab';
import { ModerationTab } from './_components/ModerationTab';
import { RbacTab } from './_components/RbacTab';
import { SocietySettingsForm } from './_components/SocietySettingsForm';
import { SocietyConfigTab } from './_components/SocietyConfigTab';
import { SocietiesTab } from './_components/SocietiesTab';
import { AdminMember, ModerationReport, Notify } from './_components/types';

type Tab =
  | 'MEMBERS'
  | 'MODERATION'
  | 'LESSONS'
  | 'ACTIVITY_LOGS'
  | 'RBAC'
  | 'SOCIETY_DETAILS'
  | 'COMMUTE_SETTINGS'
  | 'CONFIGURATION'
  | 'SOCIETIES';
const TABS: Tab[] = [
  'MEMBERS',
  'MODERATION',
  'LESSONS',
  'ACTIVITY_LOGS',
  'RBAC',
  'SOCIETY_DETAILS',
  'COMMUTE_SETTINGS',
  'CONFIGURATION',
  'SOCIETIES',
];

const ACTION_DONE = {
  APPROVE: 'Resident approved.',
  REJECT: 'Registration rejected.',
  SUSPEND: 'Resident suspended.',
  BLOCK: 'Resident blocked.',
  REACTIVATE: 'Resident reactivated.',
} as const;

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPortal />
    </Suspense>
  );
}

function AdminPortal() {
  const { society, refreshAuth, membership } = useAuth();
  const requestedTab = useSearchParams().get('tab') as Tab | null;

  const isSuperAdmin = membership?.role === 'SUPER_ADMIN';
  const can = (permission: keyof AdminPermissions) =>
    isSuperAdmin || (membership?.role === 'SOCIETY_ADMIN' && membership.permissions?.[permission] !== false);

  const visibleTabs: { id: Tab; label: React.ReactNode }[] = [];

  const [activeTab, setActiveTab] = useState<Tab>(
    requestedTab && TABS.includes(requestedTab) ? requestedTab : 'MEMBERS'
  );
  const [pendingMembers, setPendingMembers] = useState<AdminMember[]>([]);
  const [allMembers, setAllMembers] = useState<AdminMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((text, kind = 'success') => {
    setMessage({ text, kind });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const res = await apiFetch('/api/v1/admin/residents');
      if (res.ok) {
        const data = await res.json();
        setPendingMembers(data.pendingMembers || []);
        setAllMembers(data.allMembers || []);
      }
    } catch {
      notify('Failed to load residents', 'error');
    } finally {
      setLoadingMembers(false);
    }
  }, [notify]);

  const loadReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const res = await apiFetch('/api/v1/moderation/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      notify('Failed to load safety reports', 'error');
    } finally {
      setLoadingReports(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void loadMembers();
      void loadReports();
    });
    return () => {
      cancelled = true;
    };
  }, [loadMembers, loadReports, society?.id]);

  const handleMemberAction = async (
    targetUserId: string,
    action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'BLOCK' | 'REACTIVATE'
  ) => {
    const res = await apiFetch('/api/v1/admin/residents', { json: { targetUserId, action } });
    if (res.ok) {
      notify(ACTION_DONE[action]);
      await loadMembers();
    } else {
      const data = await res.json().catch(() => null);
      notify(data?.error ?? 'Could not update the member', 'error');
    }
  };

  if (can('canApproveResidents')) {
    visibleTabs.push({
      id: 'MEMBERS',
      label: `Members (${pendingMembers.length > 0 ? pendingMembers.length : allMembers.length})`,
    });
  }
  if (can('canModerateReports')) {
    visibleTabs.push({ id: 'MODERATION', label: `Reports (${reports.filter((r) => r.status === 'OPEN').length})` });
  }
  if (can('canApproveClasses')) {
    visibleTabs.push({
      id: 'LESSONS',
      label: (
        <>
          <GraduationCap className="w-3.5 h-3.5 text-purple-600" aria-hidden="true" />
          <span>Classes</span>
        </>
      ),
    });
  }
  if (can('canViewAuditLogs')) {
    visibleTabs.push({
      id: 'ACTIVITY_LOGS',
      label: (
        <>
          <History className="w-3 h-3" aria-hidden="true" /> Logs
        </>
      ),
    });
  }
  if (isSuperAdmin) {
    visibleTabs.push({ id: 'SOCIETIES', label: 'Societies' });
    visibleTabs.push({
      id: 'RBAC',
      label: (
        <>
          <Lock className="w-3 h-3" aria-hidden="true" /> RBAC
        </>
      ),
    });
  }
  if (can('canManageSettings')) {
    visibleTabs.push(
      { id: 'CONFIGURATION', label: 'Config' },
      { id: 'SOCIETY_DETAILS', label: 'Rules' },
      { id: 'COMMUTE_SETTINGS', label: 'Settings' }
    );
  }

  const currentTab = visibleTabs.some((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id;

  return (
    <div className="w-full min-w-0 max-w-md mx-auto flex-1 bg-white text-zinc-900 pb-6 p-4 flex flex-col font-sans">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="text-center">
          <h1 className="font-bold text-sm tracking-tight">Society Admin Portal</h1>
          <p className="text-[10px] text-zinc-500 font-medium">{society?.name || 'Loading society...'}</p>
        </div>
        <div className="w-8" />
      </div>

      {message && (
        <div
          role="status"
          className={`mb-4 p-3 border text-xs rounded-xl font-medium ${
            message.kind === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {visibleTabs.length === 0 ? (
        <p className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
          You don&apos;t have admin access in this society.
        </p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Admin sections"
            className="flex items-center p-1 bg-zinc-100 rounded-xl mb-4 text-xs font-semibold text-zinc-600 overflow-x-auto"
          >
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={currentTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[60px] py-2 px-2 text-center rounded-lg transition-all flex items-center justify-center gap-1 ${
                  currentTab === tab.id ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="flex-1 flex flex-col">
            {currentTab === 'MEMBERS' && society && <InviteCard society={society} notify={notify} />}
            {currentTab === 'MEMBERS' && (
              <MembersTab
                pendingMembers={pendingMembers}
                allMembers={allMembers}
                loading={loadingMembers}
                onAction={handleMemberAction}
              />
            )}
            {currentTab === 'MODERATION' && (
              <ModerationTab reports={reports} loading={loadingReports} notify={notify} onChanged={loadReports} />
            )}
            {currentTab === 'LESSONS' && <LessonsTab notify={notify} />}
            {currentTab === 'ACTIVITY_LOGS' && <ActivityLogTab />}
            {currentTab === 'RBAC' && <RbacTab members={allMembers} notify={notify} onSaved={loadMembers} />}
            {currentTab === 'SOCIETIES' && <SocietiesTab notify={notify} />}
            {currentTab === 'CONFIGURATION' && society && (
              <SocietyConfigTab key={society.id} society={society} notify={notify} onSaved={refreshAuth} />
            )}
            {(currentTab === 'SOCIETY_DETAILS' || currentTab === 'COMMUTE_SETTINGS') && society && (
              <SocietySettingsForm
                key={`${society.id}-${currentTab}`}
                society={society}
                section={currentTab === 'SOCIETY_DETAILS' ? 'DETAILS' : 'COMMUTE'}
                notify={notify}
                onSaved={refreshAuth}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
