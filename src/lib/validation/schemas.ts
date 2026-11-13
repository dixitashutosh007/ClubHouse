import { z } from 'zod';
import { MAX_CLASS_DESCRIPTION_WORDS, countWords } from './words';

/** Profile photos are stored with the resident's record, so they stay small */
export const MAX_PROFILE_PHOTO_CHARS = 150_000;

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
  meetingPoint: z.string().trim().max(80).optional(),
  destinationName: z.string().trim().min(2, 'Destination name required').max(200),
  destinationPlaceId: z.string().max(300).optional(),
  // Coordinates come from the place picker; there is no default destination
  destinationLat: z.number({ error: 'Choose the destination from the suggestions list' }).min(-90).max(90),
  destinationLng: z.number({ error: 'Choose the destination from the suggestions list' }).min(-180).max(180),
  totalSeats: z.number().int().min(1).max(6).default(2),
  genderPreference: z.enum(['ANY', 'MALE_ONLY', 'FEMALE_ONLY']).default('ANY'),
  visibility: z.enum(['SOCIETY_WIDE', 'MATCH_ONLY']).optional().default('SOCIETY_WIDE'),
  /** Repeat every week on these days (1 = Monday … 7 = Sunday) */
  repeatDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  allowClash: z.boolean().optional(),
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
  // The resident saw the "you already have a ride then" warning and went ahead
  allowClash: z.boolean().optional(),
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
  // The phone apps keep the session themselves and send it as a Bearer token
  returnToken: z.boolean().optional(),
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
  /** A small photo (the app shrinks it to 256 px); empty string removes it */
  profilePhotoUrl: z
    .string()
    .max(MAX_PROFILE_PHOTO_CHARS, 'Photo is too large. Please choose a smaller image.')
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Photo must be a JPEG, PNG or WebP image')
    .or(z.literal(''))
    .optional(),
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
  destinationPlaceId: z.string().trim().max(200).optional(),
  destinationLat: LatSchema.optional(),
  destinationLng: LngSchema.optional(),
  meetingPoint: z.string().trim().max(80).optional(),
  departureWindowStart: IsoDateTimeSchema.optional(),
  departureWindowEnd: IsoDateTimeSchema.optional(),
  totalSeats: z.number().int().min(1).max(6).optional(),
  genderPreference: z.enum(['ANY', 'MALE_ONLY', 'FEMALE_ONLY']).optional(),
});

export const JourneyIdQuerySchema = z.object({ journeyId: IdSchema });

export const RideLifecycleSchema = z.object({
  journeyId: IdSchema,
  action: z.enum(['START', 'COMPLETE']),
});

export const ScheduleIdQuerySchema = z.object({ id: IdSchema });

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
  // Without coordinates the drop-off is looked up by name (saved work locations)
  dropoffLat: LatSchema.optional(),
  dropoffLng: LngSchema.optional(),
  preferredTime: IsoDateTimeSchema.optional(),
  date: DateSchema.optional(),
}).refine(
  (v) => Boolean(v.dropoffName) || (v.dropoffLat !== undefined && v.dropoffLng !== undefined),
  'Choose a drop-off point'
);

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

export const FlatConfigSchema = z
  .object({
    towers: z.array(z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9 ]+$/, 'Tower names use letters and numbers')).max(100),
    minNumber: z.number().int().min(1).max(99999),
    maxNumber: z.number().int().min(1).max(99999),
  })
  .refine((c) => c.minNumber <= c.maxNumber, 'The lowest flat number must not be above the highest');

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
  emergencyNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{1,18}$/, 'Enter a phone number, e.g. 112 or +91 80 1234 5678')
    .or(z.literal(''))
    .optional(),
  pickupPoints: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  classLocations: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  fuelPricePerLitre: z.number().min(50).max(250).optional(),
  flatConfig: FlatConfigSchema.optional(),
});

/** An Indian mobile number, normalised to +91XXXXXXXXXX */
export const IndianMobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(\+91|91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number')
  .transform((v) => `+91${v.slice(-10)}`);

/** The society onboarding wizard (app admins only) */
export const CreateSocietySchema = z.object({
  name: z.string().trim().min(2, 'Society name is required').max(100),
  address: z.string().trim().min(3, 'Choose the society location').max(300),
  latitude: LatSchema,
  longitude: LngSchema,
  adminName: z.string().trim().min(2, "Enter the society admin's name").max(100),
  adminMobile: IndianMobileSchema,
  settings: z.object({
    require_admin_approval: z.boolean().default(true),
    allow_gender_preferences: z.boolean().default(true),
    max_detour_minutes: z.number().int().min(1).max(60).default(10),
    flat_format_example: z.string().trim().max(50).optional(),
    flatConfig: FlatConfigSchema.optional(),
    community_rules: z.string().max(5000).optional(),
    emergencyNumber: UpdateSocietySettingsSchema.shape.emergencyNumber,
    pickupPoints: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    lessonCategories: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    classLocations: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  }),
});

/** Change the admin of a society still being set up, or cancel it */
export const UpdatePendingSocietySchema = z.object({
  societyId: IdSchema,
  action: z.enum(['CHANGE_ADMIN', 'CANCEL']),
  adminName: z.string().trim().min(2).max(100).optional(),
  adminMobile: IndianMobileSchema.optional(),
});

export const CreateSuggestionSchema = z.object({
  module: z.enum(['RIDESHARE', 'CLASSES', 'GENERAL']),
  kind: z.enum(['SUGGESTION', 'REPORT']),
  message: z.string().trim().min(5, 'Please add a few words').max(1000),
});

export const UpdateSuggestionSchema = z.object({
  suggestionId: IdSchema,
  status: z.enum(['OPEN', 'DONE']),
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
  description: z
    .string()
    .trim()
    .min(10, 'Please describe the class in a sentence or two')
    .max(600)
    .refine(
      (v) => countWords(v) <= MAX_CLASS_DESCRIPTION_WORDS,
      `Please keep the description within ${MAX_CLASS_DESCRIPTION_WORDS} words`
    ),
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
  classDate: DateSchema.optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm').optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  trialAvailable: z.boolean().default(false),
  expiresOn: DateSchema.optional(),
  photoUrl: ClassPhotoSchema.optional(),
});

function checkClassFields(
  v: {
    classType?: string;
    classDate?: string;
    feeType?: string;
    feeAmount?: number;
    noAgeLimit?: boolean;
    ageMin?: number;
    ageMax?: number;
  },
  ctx: z.RefinementCtx
) {
  if (v.classType && v.classType !== 'REGULAR' && !v.classDate) {
    ctx.addIssue({ code: 'custom', message: 'Please pick the date of the class', path: ['classDate'] });
  }
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

/** A browser's Firebase Cloud Messaging token */
export const PushTokenSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.enum(['web', 'ios', 'android']).default('web'),
});

/** Deleting an account needs the word DELETE typed, as a guard against slips */
export const DeleteAccountSchema = z.object({ confirm: z.literal('DELETE') });

/** Admins remove residents who have moved out, one or several at once */
export const RemoveResidentsSchema = z.object({
  targetUserIds: z.array(IdSchema).min(1).max(100),
});

/** A resident pressed the emergency button, optionally during a ride */
export const SosSchema = z.object({ journeyId: IdSchema.optional() });

/** "I'm interested" in a class */
export const ClassInterestSchema = z.object({ listingId: IdSchema });
export const ClassInterestQuerySchema = z.object({ listingId: IdSchema.optional() });

/** A society notice */
export const CreateAnnouncementSchema = z.object({
  title: z.string().trim().min(3, 'Add a short title').max(80),
  body: z.string().trim().min(5, 'Add the details').max(1000),
  expiresOn: DateSchema.optional(),
  notify: z.boolean().default(true),
  /** Shown as "From"; defaults to the admin's name and role */
  from: z.string().trim().max(60).optional(),
});
export const AnnouncementIdQuerySchema = z.object({ id: IdSchema });

/** Admins correct a resident's name or flat */
export const EditResidentSchema = z
  .object({
    targetUserId: IdSchema,
    fullName: z.string().trim().min(2).max(100).optional(),
    flatNumber: z.string().trim().min(1).max(32).optional(),
  })
  .refine((v) => Boolean(v.fullName || v.flatNumber), 'Nothing to change');

/** App admins add or revoke a society's admins */
export const SocietyIdQuerySchema = z.object({ id: IdSchema });
export const AddSocietyAdminSchema = z.object({ societyId: IdSchema, mobile: IndianMobileSchema });
export const RevokeSocietyAdminSchema = z
  .object({ societyId: IdSchema, userId: IdSchema.optional(), mobile: IndianMobileSchema.optional() })
  .refine((v) => Boolean(v.userId || v.mobile), 'Say which admin to revoke');

export const AdminListingsQuerySchema = z.object({ kind: z.enum(['rides', 'classes']) });

export const EndTripSchema = z.object({ requestId: IdSchema, action: z.literal('END_TRIP') });

export const HideResidentSchema = z.object({ userId: IdSchema });
