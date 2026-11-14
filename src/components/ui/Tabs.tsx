'use client';

import React, { useId, useRef } from 'react';
import { cn } from './cn';
import { MODULE_THEMES, type ModuleId } from '@/lib/design/modules';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  /** Optional count shown after the label */
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  label: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: ModuleId;
  /** Id prefix that ties each tab to its panel (`${idBase}-panel-${value}`) */
  idBase?: string;
  className?: string;
}

/**
 * Tabs that switch what a page shows (e.g. Upcoming / On the way / Past).
 * Keyboard: arrow keys move between tabs. Each tab controls a panel with
 * id `${idBase}-panel-${value}`; wrap the panel in <TabPanel>.
 */
export function SegmentedTabs<T extends string>({ label, options, value, onChange, tone = 'home', idBase, className }: SegmentedTabsProps<T>) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const theme = MODULE_THEMES[tone];

  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 p-1 rounded-control bg-sunken overflow-x-auto', className)}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${o.value}`}
            aria-selected={selected}
            aria-controls={`${base}-panel-${o.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i, 1);
              if (e.key === 'ArrowLeft') move(i, -1);
            }}
            className={cn(
              'flex-1 min-w-max h-10 px-3 rounded-[8px] text-support font-semibold whitespace-nowrap transition-colors',
              selected ? cn('bg-surface shadow-raised', theme.text) : 'text-ink-muted hover:text-ink'
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 text-meta font-semibold opacity-80">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The content for one tab */
export function TabPanel({ idBase, value, children, className }: { idBase: string; value: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} className={className}>
      {children}
    </div>
  );
}
