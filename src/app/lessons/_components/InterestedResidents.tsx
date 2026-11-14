'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { BottomSheet } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/States';
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
      <Button variant="tonal" tone="classes" icon={Users} onClick={show} disabled={count === 0}>
        {count === 0 ? 'No one interested yet' : `${count} interested`}
      </Button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Interested in ${listing.subject}`}
        description="These neighbours asked to hear from you. Their details are shared only with you."
      >
        {error ? (
          <p role="alert" className="p-3 rounded-control bg-danger-bg text-support text-danger">
            {error}
          </p>
        ) : people === null ? (
          <div className="grid gap-2" role="status" aria-label="Loading">
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
          </div>
        ) : people.length === 0 ? (
          <p className="text-support text-ink-muted">No one yet.</p>
        ) : (
          <ul className="grid gap-3 max-h-[60vh] overflow-y-auto">
            {people.map((p) => (
              <li key={p.userId} className="grid gap-2 p-3 rounded-card border border-line">
                <p className="text-body font-bold text-ink">
                  {p.name}
                  {p.flatNumber ? <span className="font-normal text-ink-muted"> · Flat {p.flatNumber}</span> : null}
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
        <Button variant="secondary" fullWidth className="mt-4" onClick={() => setOpen(false)}>
          Close
        </Button>
      </BottomSheet>
    </>
  );
}
