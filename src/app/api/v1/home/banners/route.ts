import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, serverError } from '@/lib/api-auth';
import { parseQuery } from '@/lib/validation/parse';
import { BannerIdSchema } from '@/lib/validation/schemas';
import { buildHomeBanners } from '@/lib/services/home-banners';

// The resident's Home banner row (rides, approvals, circles, notices, new circles and classes)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const repo = getRepository();
    const [banners, dismissed] = await Promise.all([buildHomeBanners(repo, auth), repo.getBannerDismissals(auth.societyId, auth.userId)]);
    return NextResponse.json({
      banners,
      // Notices already dismissed, so Home can still list them as earlier notices
      dismissedNoticeIds: dismissed.filter((id) => id.startsWith('notice:')).map((id) => id.slice('notice:'.length)),
    });
  } catch (err) {
    return serverError('home banners GET', err);
  }
}

// ✕ on a banner: hidden on every device the resident uses
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const query = parseQuery(req, BannerIdSchema);
  if (query instanceof NextResponse) return query;
  try {
    // Stored per resident and society; an id only ever hides the resident's own banner
    await getRepository().addBannerDismissal(auth.societyId, auth.userId, query.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('home banners DELETE', err);
  }
}
