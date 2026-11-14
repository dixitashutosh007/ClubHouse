'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Makes the column sortable by this value */
  sortValue?: (row: T) => string | number;
  /** Hide the header text (e.g. a checkbox or actions column) */
  srOnlyHeader?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  /** Accessible name of the table */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** How a row looks on phones (below 768px), where tables do not fit */
  renderCard: (row: T) => React.ReactNode;
  /** Rows per page; omit to show every row */
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: React.ReactNode;
}

/**
 * A desktop table with sortable columns and simple pages, shown as a list of
 * cards on phones. Sorting and paging work on the rows given; it never
 * claims more than it has.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, renderCard, pageSize, initialSort, empty }: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sortCol = sort ? columns.find((c) => c.key === sort.key) : undefined;
  const sorted = sortCol?.sortValue
    ? [...rows].sort((a, b) => {
        const x = sortCol.sortValue!(a);
        const y = sortCol.sortValue!(b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true });
        return sort!.dir === 'asc' ? r : -r;
      })
    : rows;
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const shown = pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  if (rows.length === 0) return <>{empty}</>;

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  return (
    <div className="grid gap-3 min-w-0">
      <div className="hidden md:block relative min-w-0 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-sunken">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined}
                    className={cn('px-4 py-2 text-tag font-semibold uppercase tracking-wider text-ink-muted whitespace-nowrap', c.className)}
                  >
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 min-h-9 uppercase tracking-wider hover:text-ink">
                        {c.header}
                        {active ? (
                          sort!.dir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <span className={c.srOnlyHeader ? 'sr-only' : undefined}>{c.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-sunken/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-2.5 text-support text-ink align-middle', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden grid gap-2" aria-label={caption}>
        {shown.map((row) => (
          <li key={rowKey(row)} className="min-w-0">
            {renderCard(row)}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label={`${caption} pages`} className="flex items-center justify-between gap-3">
          <p className="text-meta text-ink-muted">
            {current * pageSize! + 1}–{Math.min((current + 1) * pageSize!, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-sunken disabled:opacity-40"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-meta text-ink-muted">
              Page {current + 1} of {pages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-sunken disabled:opacity-40"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
