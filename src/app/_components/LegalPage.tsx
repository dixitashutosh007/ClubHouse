import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';

/** Shared layout for the Privacy Policy and Terms of Use */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <article className="p-5 sm:p-8 rounded-card bg-surface border border-line text-body leading-relaxed text-ink">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 min-h-11 -mt-2 mb-2 text-support font-semibold text-terracotta-deep hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {APP_NAME}
        </Link>
        <h1 className="font-display text-page font-bold text-ink">{title}</h1>
        <p className="text-meta text-ink-muted mt-1 mb-6">Last updated {updated}</p>
        <div className="grid gap-6 [&_h2]:font-display [&_h2]:text-card [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:grid [&_ul]:gap-1 [&_a]:text-terracotta-deep [&_a]:underline">
          {children}
        </div>
      </article>
    </div>
  );
}

/** Where residents raise privacy questions or complaints */
export function privacyContact(): string {
  return process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || '';
}
