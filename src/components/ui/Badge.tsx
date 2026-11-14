import React from 'react';
import { cn } from './cn';
import { MODULE_THEMES, type ModuleId } from '@/lib/design/modules';

export type BadgeStatus = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const STATUS: Record<BadgeStatus, string> = {
  neutral: 'bg-sunken text-ink-muted',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
};

interface BadgeProps {
  children: React.ReactNode;
  /** Semantic state (approved, waiting, rejected...) */
  status?: BadgeStatus;
  /** Or a module identity, e.g. a "RideShare" tag. Wins over status. */
  tone?: ModuleId;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  className?: string;
}

/** Small status or category label: tint background with deep text (always AA) */
export function Badge({ children, status = 'neutral', tone, icon: Icon, className }: BadgeProps) {
  const look = tone ? `${MODULE_THEMES[tone].tint} ${MODULE_THEMES[tone].text}` : STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-tag font-semibold whitespace-nowrap',
        look,
        className
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" aria-hidden={true} />}
      {children}
    </span>
  );
}
