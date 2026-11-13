import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';

/** Shared layout for the Privacy Policy and Terms of Use */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="flex-1 bg-white px-5 py-6 text-sm leading-relaxed text-slate-800">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-4">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {APP_NAME}
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      <p className="text-xs text-slate-600 mt-1 mb-5">Last updated {updated}</p>
      <div className="space-y-5 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  );
}

/** Where residents raise privacy questions or complaints */
export function privacyContact(): string {
  return process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || '';
}
