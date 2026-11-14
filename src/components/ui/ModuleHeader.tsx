import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from './cn';
import { MODULE_THEMES, moduleById, type ModuleId } from '@/lib/design/modules';

interface ModuleHeaderProps {
  /** Which app the page belongs to: sets the icon and colour */
  module: Exclude<ModuleId, 'home'>;
  /** Page title (defaults to the app name) */
  title?: string;
  /** One line under the title */
  description?: string;
  /** A back link, for pages one level down (e.g. Offer a ride -> /rides) */
  backHref?: string;
  backLabel?: string;
  /** The page's main action, e.g. an "Offer a ride" button */
  action?: React.ReactNode;
  className?: string;
}

/** The title row of every RideShare and Classes page, in the app's colour */
export function ModuleHeader({ module, title, description, backHref, backLabel = 'Back', action, className }: ModuleHeaderProps) {
  const info = moduleById(module);
  const theme = MODULE_THEMES[module];
  const Icon = info?.icon;
  return (
    <header className={cn('flex items-center gap-3 min-w-0', className)}>
      {backHref ? (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="w-11 h-11 shrink-0 rounded-full border border-line bg-surface text-ink flex items-center justify-center hover:bg-sunken"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
      ) : (
        Icon && (
          <span className={cn('w-11 h-11 shrink-0 rounded-control flex items-center justify-center', theme.tint, theme.text)}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </span>
        )
      )}
      <div className="min-w-0 flex-1">
        {backHref && info && <p className={cn('text-tag font-semibold uppercase tracking-wider', theme.text)}>{info.name}</p>}
        <h1 className="font-display text-section md:text-page font-bold text-ink leading-tight">{title ?? info?.name}</h1>
        {description && <p className="text-support text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
