'use client';

import React, { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { AdminPermissions } from '@/types';
import { AdminMember, Notify } from './types';

type AssignableRole = 'RESIDENT' | 'SOCIETY_ADMIN';

const ALL_PERMISSIONS: Required<AdminPermissions> = {
  canApproveResidents: true,
  canManageSettings: true,
  canModerateReports: true,
  canViewAuditLogs: true,
  canApproveClasses: true,
};

const PERMISSION_LABELS: Record<keyof AdminPermissions, string> = {
  canApproveResidents: 'Approve & reject new residents',
  canManageSettings: 'Update society settings, rules & detour threshold',
  canModerateReports: 'Moderate safety reports & resolve user flags',
  canViewAuditLogs: 'View audit logs & activity history',
  canApproveClasses: 'Approve & reject class listings',
};

interface RbacTabProps {
  members: AdminMember[];
  notify: Notify;
  onSaved: () => void;
}

export function RbacTab({ members, notify, onSaved }: RbacTabProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [role, setRole] = useState<AssignableRole>('RESIDENT');
  const [permissions, setPermissions] = useState<Required<AdminPermissions>>(ALL_PERMISSIONS);
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (mem: AdminMember) => {
    setEditingUserId(mem.userId);
    setRole(mem.role === 'SOCIETY_ADMIN' ? 'SOCIETY_ADMIN' : 'RESIDENT');
    setPermissions({ ...ALL_PERMISSIONS, ...mem.permissions });
  };

  const save = async (targetUserId: string) => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/v1/admin/rbac', {
        method: 'PUT',
        json: { targetUserId, role, permissions },
      });
      if (res.ok) {
        notify('Role & permissions updated.');
        setEditingUserId(null);
        onSaved();
      } else {
        notify(await apiErrorMessage(res, 'Failed to update role'), 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-3 bg-info-bg rounded-control border border-info/40/80 mb-3 text-meta text-info">
        <span className="font-semibold mb-0.5 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-info" aria-hidden="true" />
          Role-Based Access Control (RBAC)
        </span>
        <p className="text-tag text-info leading-relaxed">
          As App Admin, designate which residents become Society Admins and configure their permissions.
        </p>
      </div>

      <div className="space-y-3">
        {members.map((mem) => {
          const isEditing = editingUserId === mem.userId;
          const isPlatformAdmin = mem.role === 'SUPER_ADMIN';
          const roleSelectId = `role-${mem.userId}`;

          return (
            <div key={mem.id} className="p-4 bg-surface rounded-card border border-line space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-support text-ink">{mem.user.fullName}</span>
                    <span
                      className={`text-tag font-bold px-2 py-0.5 rounded-full ${
                        mem.role === 'SUPER_ADMIN'
                          ? 'bg-info-bg text-info'
                          : mem.role === 'SOCIETY_ADMIN'
                            ? 'bg-ink text-ink-inverse'
                            : 'bg-sunken text-ink-muted'
                      }`}
                    >
                      {mem.role}
                    </span>
                  </div>
                  <p className="text-meta text-ink-muted mt-0.5">
                    Flat {mem.flatNumber || 'N/A'} • {mem.user.mobile}
                  </p>
                </div>

                {!isPlatformAdmin && (
                  <button
                    onClick={() => (isEditing ? setEditingUserId(null) : startEditing(mem))}
                    aria-expanded={isEditing}
                    className={`text-meta px-3 py-1.5 rounded-control font-semibold border transition-all ${
                      isEditing
                        ? 'bg-sunken border-line-strong text-ink-muted'
                        : 'bg-surface border-info/40 text-info hover:bg-info-bg'
                    }`}
                  >
                    {isEditing ? 'Cancel' : 'Edit Permissions'}
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="pt-3 border-t border-line space-y-3 bg-sunken p-3 rounded-control">
                  <div>
                    <label htmlFor={roleSelectId} className="text-tag font-bold text-ink-muted block mb-1">
                      Role
                    </label>
                    <select
                      id={roleSelectId}
                      value={role}
                      onChange={(e) => setRole(e.target.value as AssignableRole)}
                      className="w-full text-meta p-2 rounded-control border border-line-strong bg-surface"
                    >
                      <option value="RESIDENT">RESIDENT (Commuter only)</option>
                      <option value="SOCIETY_ADMIN">SOCIETY_ADMIN (Society Manager)</option>
                    </select>
                  </div>

                  {role === 'SOCIETY_ADMIN' && (
                    <fieldset>
                      <legend className="text-tag font-bold text-ink-muted mb-1.5">
                        Society Admin Permissions
                      </legend>
                      <div className="space-y-2">
                        {(Object.keys(PERMISSION_LABELS) as (keyof AdminPermissions)[]).map((key) => (
                          <label key={key} className="flex items-center gap-2 text-meta text-ink-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions[key]}
                              onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))}
                              className="w-4 h-4 text-info rounded-sm"
                            />
                            <span>{PERMISSION_LABELS[key]}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => save(mem.userId)}
                      disabled={isSaving}
                      className="px-4 py-2 bg-indigo-600 text-ink-inverse rounded-control text-meta font-semibold hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isSaving ? 'Saving…' : 'Save Role & Permissions'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
