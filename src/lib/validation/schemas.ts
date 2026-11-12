import { z } from 'zod';

// Phone number regex for Indian standard: +91 followed by 10 digits
export const phoneRegex = /^(\+91)?[6-9]\d{9}$/;

// Ride creation schema
export const CreateRideSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  journeyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required'),
  departureWindowStart: z
    .string()
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Departure window start required'),
  departureWindowEnd: z
    .string()
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Valid departure window end required')
    .optional(),
  direction: z.enum(['OUTBOUND_SOCIETY', 'INBOUND_SOCIETY']).optional().default('OUTBOUND_SOCIETY'),
  originName: z.string().trim().max(200).optional(),
  originLat: z.number().min(-90).max(90).optional(),
  originLng: z.number().min(-180).max(180).optional(),
  destinationName: z.string().trim().min(2, 'Destination name required').max(200),
  destinationPlaceId: z.string().max(300).optional(),
  // Coordinates come from the place picker; there is no default destination
  destinationLat: z.number({ error: 'Choose the destination from the suggestions list' }).min(-90).max(90),
  destinationLng: z.number({ error: 'Choose the destination from the suggestions list' }).min(-180).max(180),
  totalSeats: z.number().int().min(1).max(6).default(2),
  genderPreference: z.enum(['ANY', 'MALE_ONLY', 'FEMALE_ONLY']).default('ANY'),
  visibility: z.enum(['SOCIETY_WIDE', 'MATCH_ONLY']).optional().default('SOCIETY_WIDE'),
});

// Ride request schema
export const CreateRideRequestSchema = z.object({
  journeyId: z.string().min(1, 'journeyId is required'),
  requestedSeats: z.number().int().min(1).max(4).default(1),
  pickupName: z.string().trim().max(200).optional(),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  dropoffName: z.string().trim().max(200).optional(),
  dropoffLat: z.number().min(-90).max(90).optional(),
  dropoffLng: z.number().min(-180).max(180).optional(),
});

const GenderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);

// Society search for a newly verified number that belongs to no society yet
export const SocietySearchSchema = z.object({
  idToken: z.string().min(1).max(4096),
  query: z.string().trim().min(2, 'Type at least 2 letters of your society name').max(60),
});

// Session creation (phone OTP sign-in)
export const CreateSessionSchema = z.object({
  idToken: z.string().min(1).max(4096),
  // Joining: an invite code from a link, or a society picked in the search
  societyCode: z.string().min(2).max(32).optional(),
  societyId: z.string().trim().min(1).max(128).optional(),
});

// Member registration schema (signed-in user joining a society by invite code).
// The mobile number always comes from the verified sign-in, never the form.
export const MemberRegistrationSchema = z.object({
  // Either the invite code (from a link) or the society ID (from the search)
  societyCode: z.string().min(2).max(32).optional(),
  societyId: z.string().trim().min(1).max(128).optional(),
  fullName: z.string().trim().min(2, 'Full name required').max(100),
  email: z.string().trim().toLowerCase().email('Valid email address required').max(254),
  flatNumber: z.string().trim().min(1, 'Flat / Apartment number required').max(32),
  gender: GenderSchema.default('PREFER_NOT_TO_SAY'),
  workLocationName: z.string().trim().max(200).optional(),
}).refine((v) => Boolean(v.societyCode || v.societyId), 'Society invitation code required');

// Profile update. Mobile changes go through the verified /auth/phone route.
export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email('Valid email address required').max(254).optional(),
  flatNumber: z.string().trim().min(1).max(32).optional(),
  commuteIntent: z.enum(['OFFERER', 'SEEKER', 'BOTH']).optional(),
  workLocationName: z.string().trim().max(200).optional(),
  workLatitude: z.number().min(-90).max(90).optional(),
  workLongitude: z.number().min(-180).max(180).optional(),
  gender: GenderSchema.optional(),
  profileCompleted: z.boolean().optional(),
});

// Verified mobile number change: an ID token issued after updatePhoneNumber()
export const VerifyPhoneChangeSchema = z.object({
  idToken: z.string().min(1).max(4096),
  // Development only: the new number when using a dev token
  devPhoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
});

// Feedback schema
export const FeedbackSchema = z.object({
  journeyId: z.string().min(1, 'journeyId required'),
  toUserId: z.string().min(1, 'toUserId required'),
  role: z.enum(['OFFERER', 'SEEKER']).default('SEEKER'),
  outcome: z.enum([
    'COMPLETED',
    'DRIVER_CANCELLED',
    'PASSENGER_CANCELLED',
    'PASSENGER_NO_SHOW',
    'DRIVER_NO_SHOW',
    'OTHER',
  ]),
  qualitativeTags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  privateNote: z.string().max(500).optional(),
});

// Moderation report schema
export const ModerationReportSchema = z.object({
  reportedUserId: z.string().min(1, 'reportedUserId required'),
  journeyId: z.string().optional(),
  category: z.enum([
    'INAPPROPRIATE_BEHAVIOUR',
    'MISREPRESENTATION',
    'REPEATED_CANCELLATION',
    'NO_SHOW',
    'SAFETY_CONCERN',
    'HARASSMENT',
    'OTHER',
  ]),
  description: z.string().min(5, 'Detailed description required').max(1000),
});

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const IdSchema = z.string().trim().min(1).max(128);
const LatSchema = z.number().min(-90).max(90);
const LngSchema = z.number().min(-180).max(180);
const CoordSchema = z.object({ lat: LatSchema, lng: LngSchema });
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required');
const IsoDateTimeSchema = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'Valid date-time required');

// ---------------------------------------------------------------------------
// Rides
// ---------------------------------------------------------------------------

export const ListRidesQuerySchema = z.object({
  date: z.union([DateSchema, z.literal('ALL')]).optional(),
  mine: z.enum(['true', 'false']).optional(),
});

export const UpdateRideSchema = z.object({
  journeyId: IdSchema,
  destinationName: z.string().trim().min(2).max(200).optional(),
  departureWindowStart: IsoDateTimeSchema.optional(),
  departureWindowEnd: IsoDateTimeSchema.optional(),
  totalSeats: z.number().int().min(1).max(6).optional(),
  genderPreference: z.enum(['ANY', 'MALE_ONLY', 'FEMALE_ONLY']).optional(),
});

export const JourneyIdQuerySchema = z.object({ journeyId: IdSchema });

export const CancelRideQuerySchema = z.object({
  journeyId: IdSchema,
  reason: z.string().trim().max(300).optional(),
});

export const RespondToRequestSchema = z.object({
  requestId: IdSchema,
  action: z.enum(['ACCEPT', 'REJECT']),
  note: z.string().trim().max(300).optional(),
});

export const RequestIdQuerySchema = z.object({ requestId: IdSchema });

export const ListRequestsQuerySchema = z.object({ journeyId: IdSchema.optional() });

export const FindMatchesSchema = z.object({
  pickupName: z.string().trim().max(200).optional(),
  pickupLat: LatSchema.optional(),
  pickupLng: LngSchema.optional(),
  dropoffName: z.string().trim().max(200).optional(),
  dropoffLat: LatSchema,
  dropoffLng: LngSchema,
  preferredTime: IsoDateTimeSchema.optional(),
  date: DateSchema.optional(),
});

export const FeedbackQuerySchema = z.object({ userId: IdSchema.optional() });

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export const CreateVehicleSchema = z.object({
  type: z.enum(['CAR', 'SUV', 'HATCHBACK', 'SEDAN', 'TWO_WHEELER']).default('CAR'),
  make: z.string().trim().min(1, 'Missing vehicle details').max(50),
  model: z.string().trim().min(1, 'Missing vehicle details').max(50),
  color: z.string().trim().max(30).optional(),
  registrationNumber: z.string().trim().min(4, 'Missing vehicle details').max(20),
  capacity: z.number().int().min(1).max(8).optional(),
  mileageKmPerLitre: z.number().min(5).max(60).optional(),
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const MarkNotificationsSchema = z.union([
  z.object({ markAll: z.literal(true) }),
  z.object({ notificationId: IdSchema }),
], { error: 'Provide either notificationId or markAll' });

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export const UpdateReportSchema = z.object({
  reportId: IdSchema,
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED']),
  resolutionNotes: z.string().trim().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const ResidentsQuerySchema = z.object({ all: z.enum(['true', 'false']).optional() });

export const ResidentActionSchema = z.object({
  targetUserId: IdSchema,
  action: z.enum(['APPROVE', 'REJECT', 'SUSPEND', 'BLOCK', 'REACTIVATE']),
  reason: z.string().trim().max(500).optional(),
});

export const UpdateRbacSchema = z.object({
  targetUserId: IdSchema,
  targetSocietyId: IdSchema.optional(),
  // SUPER_ADMIN is granted outside the app, never through this endpoint
  role: z.enum(['RESIDENT', 'SOCIETY_ADMIN']),
  permissions: z
    .object({
      canApproveResidents: z.boolean().optional(),
      canManageSettings: z.boolean().optional(),
      canModerateReports: z.boolean().optional(),
      canViewAuditLogs: z.boolean().optional(),
      canApproveClasses: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Admin-entered regex for flat numbers. Kept short and free of nested
 * quantifiers such as (a+)+ that can hang the server (ReDoS).
 */
const FlatPatternSchema = z
  .string()
  .max(100, 'Flat format pattern must be at most 100 characters')
  .refine((p) => {
    try {
      new RegExp(p);
      return true;
    } catch {
      return false;
    }
  }, 'Flat format pattern is not a valid regular expression')
  .refine(
    (p) => !/\([^)]*[+*}][^)]*\)\s*[+*{]/.test(p),
    'Flat format pattern must not contain nested repetition'
  );

export const UpdateSocietySettingsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().max(300).optional(),
  latitude: LatSchema.optional(),
  longitude: LngSchema.optional(),
  community_rules: z.string().max(5000).optional(),
  max_detour_minutes: z.number().int().min(1).max(60).optional(),
  require_admin_approval: z.boolean().optional(),
  allow_gender_preferences: z.boolean().optional(),
  flat_format_pattern: FlatPatternSchema.optional(),
  flat_format_example: z.string().trim().max(50).optional(),
  lessonCategories: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
});

// ---------------------------------------------------------------------------
// Places & routing
// ---------------------------------------------------------------------------

export const PlacesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  placeId: z.string().trim().max(300).optional(),
});

export const RoutesMatrixSchema = z.object({
  origin: CoordSchema,
  destination: CoordSchema,
  waypoints: z.array(CoordSchema).max(5).optional(),
});

// ---------------------------------------------------------------------------
// Lessons / Classes
// ---------------------------------------------------------------------------

const ClassTypeSchema = z.enum(['ONE_TIME', 'FESTIVE', 'REGULAR']);
const FeeTypeSchema = z.enum(['FREE', 'PER_SESSION', 'PER_MONTH', 'PER_COURSE']);
const WeekdaySchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'FLEXIBLE']);

/**
 * Class photos are stored inline as small data URLs (the page downsizes them
 * first). Only JPEG/PNG/WebP, and well under Firestore's 1 MB document limit.
 */
export const MAX_CLASS_PHOTO_CHARS = 600_000;
const ClassPhotoSchema = z
  .string()
  .max(MAX_CLASS_PHOTO_CHARS, 'Photo is too large. Please choose a smaller image.')
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Photo must be a JPEG, PNG or WebP image');

const ClassFieldsSchema = z.object({
  classType: ClassTypeSchema,
  subject: z.string().trim().min(2, 'Subject required').max(60),
  isCustomSubject: z.boolean().optional(),
  description: z.string().trim().min(10, 'Please describe the class in a sentence or two').max(1500),
  feeType: FeeTypeSchema,
  feeAmount: z.number().int().min(1).max(100_000).optional(),
  contactName: z.string().trim().min(2).max(100),
  contactPhone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'Enter a valid 10-digit mobile number'),
  locationType: z.enum(['CLUBHOUSE', 'FLAT', 'OTHER']),
  locationDetail: z.string().trim().max(120).optional(),
  noAgeLimit: z.boolean().default(true),
  ageMin: z.number().int().min(0).max(100).optional(),
  ageMax: z.number().int().min(0).max(100).optional(),
  scheduleDays: z.array(WeekdaySchema).max(8).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm').optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  trialAvailable: z.boolean().default(false),
  expiresOn: DateSchema.optional(),
  photoUrl: ClassPhotoSchema.optional(),
});

function checkClassFields(
  v: { feeType?: string; feeAmount?: number; noAgeLimit?: boolean; ageMin?: number; ageMax?: number },
  ctx: z.RefinementCtx
) {
  if (v.feeType && v.feeType !== 'FREE' && !v.feeAmount) {
    ctx.addIssue({ code: 'custom', message: 'Please enter the fee amount', path: ['feeAmount'] });
  }
  if (v.noAgeLimit === false && v.ageMin !== undefined && v.ageMax !== undefined && v.ageMin > v.ageMax) {
    ctx.addIssue({ code: 'custom', message: 'Minimum age must not exceed maximum age', path: ['ageMin'] });
  }
}

export const CreateClassSchema = ClassFieldsSchema.superRefine(checkClassFields);

export const UpdateClassSchema = ClassFieldsSchema.partial()
  .extend({ listingId: IdSchema, photoUrl: ClassPhotoSchema.or(z.literal('')).optional() })
  .superRefine(checkClassFields);

export const ClassActionSchema = z.object({
  listingId: IdSchema,
  action: z.enum(['APPROVE', 'REJECT', 'MARK_FULL', 'DEACTIVATE', 'REACTIVATE']),
  reason: z.string().trim().max(300).optional(),
});

export const ListClassesQuerySchema = z.object({
  subject: z.string().trim().max(60).optional(),
  classType: ClassTypeSchema.optional(),
  mine: z.enum(['true', 'false']).optional(),
  pending: z.enum(['true', 'false']).optional(),
});

export const ClassIdQuerySchema = z.object({ id: IdSchema });

export const ClassCategoriesSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(50)).max(30),
});
