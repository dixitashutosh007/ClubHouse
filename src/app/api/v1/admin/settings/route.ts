import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/api-auth';
import { UpdateSocietySettingsSchema } from '@/lib/validation/schemas';
import { parseBody } from '@/lib/validation/parse';

// Update society profile and settings (name, address, location, rules, detour threshold)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canManageSettings' });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, UpdateSocietySettingsSchema);
  if (body instanceof NextResponse) return body;
  const {
    name,
    address,
    latitude,
    longitude,
    community_rules,
    max_detour_minutes,
    require_admin_approval,
    allow_gender_preferences,
    flat_format_pattern,
    flat_format_example,
    lessonCategories,
  } = body;

  const repo = getRepository();

  // Update society top-level profile attributes if provided
  let society = await repo.getSocietyById(auth.societyId);
  if (!society) return errorResponse('Society not found', 404);

  const societyUpdates: Partial<typeof society> = {};
  if (name !== undefined) societyUpdates.name = name;
  if (address !== undefined) societyUpdates.address = address;
  if (latitude !== undefined) societyUpdates.latitude = latitude;
  if (longitude !== undefined) societyUpdates.longitude = longitude;

  if (Object.keys(societyUpdates).length > 0) {
    society = await repo.updateSociety(auth.societyId, societyUpdates);
  }

  // Update society settings
  const settingsUpdates: Partial<typeof society.settings> = {};
  if (max_detour_minutes !== undefined) settingsUpdates.max_detour_minutes = max_detour_minutes;
  if (require_admin_approval !== undefined) settingsUpdates.require_admin_approval = require_admin_approval;
  if (allow_gender_preferences !== undefined) settingsUpdates.allow_gender_preferences = allow_gender_preferences;
  if (community_rules !== undefined) settingsUpdates.community_rules = community_rules;
  if (flat_format_pattern !== undefined) settingsUpdates.flat_format_pattern = flat_format_pattern;
  if (flat_format_example !== undefined) settingsUpdates.flat_format_example = flat_format_example;
  if (lessonCategories !== undefined && Array.isArray(lessonCategories)) {
    settingsUpdates.lessonCategories = lessonCategories;
  }

  if (Object.keys(settingsUpdates).length > 0) {
    society = await repo.updateSocietySettings(auth.societyId, settingsUpdates);
  }

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'SOCIETY_PROFILE_AND_SETTINGS_UPDATED',
    entityType: 'SOCIETY',
    entityId: auth.societyId,
    metadata: { societyUpdates, settingsUpdates },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, society, settings: society.settings });
}
