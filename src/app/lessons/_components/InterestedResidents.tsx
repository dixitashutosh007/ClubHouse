'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { RideContactActions } from '@/components/RideContactActions';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { ClassListing } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface InterestedPerson {
  userId: string;
  name: string;
  flatNumber?: string;
  mobile: string;
}

/** For the teacher: neighbours who tapped "I'm interested", with their contact details */
export function InterestedResidents({ listing }: { listing: ClassListing }) {
  const { user, society } = useAuth();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<InterestedPerson[] | null>(null);
  const [error, setError] = useState('');
  const count = listing.interestedCount ?? 0;

  const show = async () => {
    setOpen(true);
    setError('');
    const res = await apiFetch(`/api/v1/lessons/interest?listingId=${encodeURIComponent(listing.id)}`);
    if (res.ok) setPeople(((await res.json()) as { interested: InterestedPerson[] }).interested);
    else setError(await apiErrorMessage(res, 'Could not load who is interested.'));
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        disabled={count === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-300 bg-violet-50 text-violet-900 text-[11px] font-bold disabled:opacity-50"
      >
        <Users className="w-3.5 h-3.5" aria-hidden="true" />
        {count === 0 ? 'No one interested yet' : `${count} interested`}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Interested in ${listing.subject}`}
        description="These neighbours asked to hear from you. Their details are shared only with you."
      >
        {error ? (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        ) : people === null ? (
          <p className="text-sm text-slate-700">Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-slate-700">No one yet.</p>
        ) : (
          <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
            {people.map((p) => (
              <li key={p.userId} className="p-3 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-sm font-bold text-slate-900">
                  {p.name}
                  {p.flatNumber ? <span className="font-normal text-slate-700"> · Flat {p.flatNumber}</span> : null}
                </p>
                <RideContactActions
                  name={p.name}
                  mobile={p.mobile}
                  message={`Hi ${p.name.split(' ')[0]}, this is ${user?.fullName.split(' ')[0] ?? 'your neighbour'}${society?.name ? ` from ${society.name}` : ''}. Thanks for your interest in my ${listing.subject} class! Happy to share the details.`}
                />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 w-full py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800"
        >
          Close
        </button>
      </Dialog>
    </>
  );
}
