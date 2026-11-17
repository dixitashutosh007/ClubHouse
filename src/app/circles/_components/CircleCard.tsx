import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { CircleView } from '@/lib/services/circles';
import { unreadLabel } from '@/hooks/useCircleUnread';
import { circleAudienceLabel, circleStatusLabel, circleTypeLabel, memberCountLabel, viewerStatusLabel } from './circle-format';

/** One circle in a list; the whole card opens the circle (a preview has no link) */
export function CircleCard({ circle, preview = false, unread = 0 }: { circle: CircleView; preview?: boolean; unread?: number }) {
  const mine = viewerStatusLabel(circle);
  const status = circleStatusLabel(circle.status);
  return (
    <Card
      as="article"
      padding="none"
      className="h-full overflow-hidden relative flex flex-col hover:border-community-deep/50 transition-colors"
    >
      {circle.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- photos are inline data URLs, which next/image cannot optimise
        <img src={circle.photoUrl} alt="" className="w-full h-32 object-cover border-b border-line" />
      )}
      <div className="p-4 grid gap-2 flex-1 content-start">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="community">{circleTypeLabel(circle)}</Badge>
          {circle.audience !== 'ALL' && <Badge>{circleAudienceLabel(circle)}</Badge>}
          {status && <Badge status={circle.status === 'PENDING_APPROVAL' ? 'warning' : 'neutral'}>{status}</Badge>}
          {mine && (
            <Badge status={circle.viewer.status === 'REJECTED' ? 'danger' : circle.viewer.status === 'REQUESTED' ? 'info' : 'success'}>
              {mine}
            </Badge>
          )}
          {circle.pendingChange && <Badge status="warning">Change waiting</Badge>}
          {unread > 0 && (
            <Badge tone="community">
              {unreadLabel(unread)} {unread === 1 ? 'message' : 'messages'}
            </Badge>
          )}
        </div>
        <h2 className="font-display text-card font-bold text-ink break-words">
          {/* The link covers the whole card */}
          {preview ? (
            circle.name
          ) : (
            <Link
              href={`/circles/${circle.id}`}
              className="after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-3 focus-visible:after:ring-community-deep after:rounded-card"
            >
              {circle.name}
            </Link>
          )}
        </h2>
        <p className="text-support text-ink line-clamp-2">{circle.description}</p>
        <ul className="grid gap-1 text-meta text-ink-muted">
          <li className="flex items-center gap-1.5 min-w-0">
            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{memberCountLabel(circle.memberCount)}</span>
            {circle.joinMode === 'OPEN' && <span className="text-community-deep font-semibold">· Open to join</span>}
          </li>
          {circle.place && (
            <li className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{circle.place}</span>
            </li>
          )}
          {circle.schedule && (
            <li className="flex items-center gap-1.5 min-w-0">
              <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{circle.schedule}</span>
            </li>
          )}
        </ul>
      </div>
    </Card>
  );
}
