import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { ClassCategoriesSchema } from '@/lib/validation/schemas';
import { parseBody } from '@/lib/validation/parse';

const DEFAULT_CLASS_CATEGORIES = [
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

// The society's class subjects (admins set them; otherwise a default list)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const society = await getRepository().getSocietyById(auth.societyId);
  const configured = society?.settings?.lessonCategories;
  return NextResponse.json({ categories: configured?.length ? configured : DEFAULT_CLASS_CATEGORIES });
}

// Replace the society's class subjects
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canManageSettings' });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, ClassCategoriesSchema);
  if (body instanceof NextResponse) return body;

  const categories = [...new Set(body.categories)];
  const repo = getRepository();
  const updated = await repo.updateSocietySettings(auth.societyId, { lessonCategories: categories });

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_CATEGORIES_UPDATED',
    entityType: 'SOCIETY_SETTINGS',
    entityId: auth.societyId,
    metadata: { categories },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, categories: updated.settings.lessonCategories });
}
