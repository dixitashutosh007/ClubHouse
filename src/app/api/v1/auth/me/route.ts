import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { ONBOARDING_STATUSES, errorResponse, requireAuth } from '@/lib/api-auth';
import { UpdateProfileSchema } from '@/lib/validation/schemas';
import { MembershipStatus, Society, SocietyMembership, User } from '@/types';
import { findKnownPlace } from '@/lib/services/places-data';
import { flatNumberError, normalizeFlat } from '@/lib/flat-number';

// Any membership status may read its own profile, so the UI can show
// pending, suspended or rejected states
const ALL_STATUSES: MembershipStatus[] = [
  'INVITED',
  'REGISTERED',
  'PENDING_APPROVAL',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
  'DEACTIVATED',
];

/**
 * The society as this member may see it: admins get everything; approved
 * residents get the settings the apps use but not the invite code; members
 * still waiting for approval get only what onboarding needs.
 */
function societyFor(society: Society | null, membership: SocietyMembership | null): Partial<Society> | null {
  if (!society) return null;
  const isAdmin = membership?.role === 'SOCIETY_ADMIN' || membership?.role === 'SUPER_ADMIN';
  if (isAdmin && membership?.status === 'ACTIVE') return society;

  const { id, slug, name, address, latitude, longitude, status, settings } = society;
  if (membership?.status === 'ACTIVE') {
    return { id, slug, name, address, latitude, longitude, status, settings };
  }
  return {
    id,
    slug,
    name,
    address,
    status,
    settings: {
      max_detour_minutes: settings.max_detour_minutes,
      require_admin_approval: settings.require_admin_approval,
      allow_gender_preferences: settings.allow_gender_preferences,
      community_rules: settings.community_rules,
      flat_format_example: settings.flat_format_example,
      flatConfig: settings.flatConfig,
    },
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ALL_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const repo = getRepository();
  const user = await repo.getUserById(auth.userId);
  const society = await repo.getSocietyById(auth.societyId);
  const membership = await repo.getMembership(auth.societyId, auth.userId);

  return NextResponse.json({
    user,
    society: societyFor(society, membership),
    membership,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const parsed = UpdateProfileSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Invalid profile details');
  }
  const {
    fullName,
    email,
    flatNumber,
    commuteIntent,
    workLocationName,
    workLatitude,
    workLongitude,
    gender,
    profileCompleted,
    profilePhotoUrl,
  } = parsed.data;

  const repo = getRepository();
  const existingUser = await repo.getUserById(auth.userId);
  if (!existingUser) return errorResponse('Unauthorized', 401);

  // Flat numbers follow the society's towers and number range; check before saving anything
  const flatConfig = flatNumber ? (await repo.getSocietyById(auth.societyId))?.settings.flatConfig : undefined;
  if (flatNumber && flatConfig) {
    const flatError = flatNumberError(flatNumber, flatConfig);
    if (flatError) return errorResponse(flatError);
  }

  // 1. Update user record
  const userUpdates: Partial<User> = {};
  if (fullName) userUpdates.fullName = fullName;
  if (email && email !== existingUser.email) {
    // Email is contact info only, never an identity; mark it unverified
    userUpdates.email = email;
    userUpdates.emailVerified = false;
  }
  if (commuteIntent) userUpdates.commuteIntent = commuteIntent;
  if (workLocationName !== undefined) {
    userUpdates.workLocationName = workLocationName;
    // A known hub picked by name only still gets its coordinates, so ride matching works
    const known = workLatitude === undefined ? findKnownPlace(workLocationName) : null;
    if (known) {
      userUpdates.workLatitude = known.lat;
      userUpdates.workLongitude = known.lng;
    }
    // Coordinates only travel with a place picked from suggestions; typed text clears them
    if (!known) {
      userUpdates.workLatitude = workLatitude;
      userUpdates.workLongitude = workLongitude;
    }
  }
  if (gender) userUpdates.gender = gender;
  if (profileCompleted !== undefined) userUpdates.profileCompleted = profileCompleted;
  if (profilePhotoUrl !== undefined) userUpdates.profilePhotoUrl = profilePhotoUrl || undefined;

  const updatedUser = await repo.updateUser(auth.userId, userUpdates);

  // 2. Update membership flat if provided (checked above)
  let updatedMembership = await repo.getMembership(auth.societyId, auth.userId);
  if (flatNumber && updatedMembership) {
    updatedMembership = await repo.updateMembership(auth.societyId, auth.userId, {
      flatNumber: flatConfig ? normalizeFlat(flatNumber, flatConfig) : flatNumber,
    });
  }

  // 3. Check vehicles if user wants to be an OFFERER
  const vehicles = await repo.listUserVehicles(auth.societyId, auth.userId);

  return NextResponse.json({
    success: true,
    user: updatedUser,
    membership: updatedMembership,
    hasVehicle: vehicles.length > 0,
  });
}
