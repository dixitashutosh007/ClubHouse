import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from './cn';
import type { ModuleInfo } from '@/lib/design/modules';

type CardProps = React.HTMLAttributes<HTMLElement> & {
  /** Element to render: a list item, article or plain div */
  as?: 'div' | 'article' | 'li' | 'section';
  /** Inner spacing; 'none' for media or lists that bleed to the edge */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Float above the page (menus, featured cards). Most cards use the border only. */
  raised?: boolean;
};

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5 lg:p-6' };

/** White content card on the ivory page: 1px border, 16px radius, no shadow by default */
export function Card({ as: Tag = 'div', padding = 'md', raised = false, className, ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      className={cn('bg-surface border border-line rounded-card min-w-0', PADDING[padding], raised && 'shadow-raised', className)}
    />
  );
}

interface ModuleCardProps {
  module: ModuleInfo;
  /** Short live fact from real data, e.g. "4 rides tomorrow". Leave out when unknown. */
  detail?: string;
  className?: string;
}

/**
 * An app tile. Live apps are links in the module colour; Coming soon apps
 * are muted, labelled, and not interactive.
 */
export function ModuleCard({ module, detail, className }: ModuleCardProps) {
  const Icon = module.icon;

  if (module.status !== 'live' || !module.href) {
    return (
      <div
        className={cn(
          'rounded-card border border-dashed border-line-strong/60 bg-surface/60 p-4 flex flex-col gap-3 min-w-0',
          className
        )}
      >
        <span className={cn('w-10 h-10 rounded-control flex items-center justify-center', module.theme.tint, module.theme.text)}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-body sm:text-card font-bold text-ink">{module.name}</span>
          <span className="block text-meta text-ink-muted">{module.tagline}</span>
        </span>
        <span className="self-start text-tag font-semibold text-ink-muted bg-sunken px-2 py-0.5 rounded-full">Coming soon</span>
      </div>
    );
  }

  return (
    <Link
      href={module.href}
      className={cn(
        'group rounded-card p-4 flex flex-col justify-between gap-6 min-h-36 min-w-0 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-raised motion-reduce:hover:translate-y-0',
        module.theme.fill,
        className
      )}
    >
      <span className="w-11 h-11 rounded-control bg-white/20 flex items-center justify-center">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2 font-display text-section font-bold">
          {module.name}
          <ArrowRight className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
        <span className="block text-meta font-medium">{detail ?? module.tagline}</span>
      </span>
    </Link>
  );
}
