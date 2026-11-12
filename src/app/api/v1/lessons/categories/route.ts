import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { getAuthContext, errorResponse } from '@/lib/api-auth';

const DEFAULT_CATEGORIES = [
  'Yoga',
  'Music',
  'Art & Craft',
  'Piano',
  'Maths',
  'Language',
  'Fitness',
  'Coding',
  'Hobby',
  'Analytics',
];

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);

  const repo = getRepository();
  const society = await repo.getSocietyById(auth.societyId);
  const categories = society?.settings?.lessonCategories && society.settings.lessonCategories.length > 0
    ? society.settings.lessonCategories
    : DEFAULT_CATEGORIES;

  return NextResponse.json({ categories });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);
  if (auth.role !== 'SOCIETY_ADMIN' && auth.role !== 'SUPER_ADMIN') {
    return errorResponse('Forbidden: Society Admin role required', 403);
  }

  const body = await req.json();
  const { categories } = body;

  if (!Array.isArray(categories)) {
    return errorResponse('Categories must be an array of strings', 400);
  }

  const repo = getRepository();
  const updatedSociety = await repo.updateSocietySettings(auth.societyId, {
    lessonCategories: categories.map((c) => String(c).trim()).filter(Boolean),
  });

  await repo.recordAuditEvent({
    id: `audit-${Date.now()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_CATEGORIES_UPDATED',
    entityType: 'SOCIETY_SETTINGS',
    entityId: auth.societyId,
    metadata: { categories: updatedSociety.settings.lessonCategories },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    categories: updatedSociety.settings.lessonCategories,
  });
}
