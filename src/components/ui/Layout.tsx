import React from 'react';
import { cn } from './cn';

type Width = 'narrow' | 'default' | 'wide';

/** 640px for forms and reading, 960px for lists, 1200px for dashboards and tables */
const MAX: Record<Width, string> = {
  narrow: 'max-w-2xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
};

/**
 * Page padding and maximum width; 16px side gutters on phones, more on larger
 * screens. Using it marks the page as redesigned: the shell then gives it the
 * full width instead of the legacy centred column.
 */
export function PageContainer({
  width = 'default',
  className,
  children,
}: {
  width?: Width;
  className?: string;
  children: React.ReactNode;
}) {
  // data-full-width tells the app shell this page is designed for every screen width
  return (
    <div data-full-width="" className={cn('w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8', MAX[width], className)}>
      {children}
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  /** Heading level for the document outline (default h2) */
  level?: 2 | 3;
  description?: string;
  /** Optional action on the right, e.g. a "See all" link */
  action?: React.ReactNode;
  id?: string;
  className?: string;
}

/** A section title with an optional one-line description and action */
export function SectionHeading({ title, level = 2, description, action, id, className }: SectionHeadingProps) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <Tag id={id} className={cn('font-display font-bold text-ink', level === 2 ? 'text-section' : 'text-card')}>
          {title}
        </Tag>
        {description && <p className="text-support text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
