/**
 * PENDING_SETUP: added by an app admin, waiting for its society admin to sign
 * in with the verified mobile number; nobody can join until then.
 */
export type SocietyStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_SETUP';

/** How flat numbers are written in a society */
export interface FlatNumberConfig {
  /** Tower, block or wing names; empty when flats have no tower (e.g. "443") */
  towers: string[];
  /** Lowest and highest flat number, e.g. 101 and 2404 */
  minNumber: number;
  maxNumber: number;
}

export interface SocietySettings {
  max_detour_minutes: number;
  require_admin_approval: boolean;
  allow_gender_preferences: boolean;
  community_rules?: string;
  flat_format_pattern?: string; // e.g. "TOWER_FLAT" or "FLAT_ONLY" or "BLOCK_FLAT"
  flat_format_example?: string; // e.g. "Tower A - 1202" or "#422" or "A1-1202"
  /** Towers and flat number range; residents pick from these */
  flatConfig?: FlatNumberConfig;
  lessonCategories?: string[]; // Preset subjects for lessons/classes
  /** RideShare: the number residents call from the trip safety bar (e.g. the security desk) */
  emergencyNumber?: string;
  /** RideShare: petrol price used for fuel-share estimates (₹ per litre) */
  fuelPricePerLitre?: number;
  /** RideShare: meeting points inside the society, e.g. "Main Gate", "Tower B3 Lobby" */
  pickupPoints?: string[];
  /** Classes: places where classes are held, e.g. "Clubhouse Hall", "Amphitheatre" */
  classLocations?: string[];
}

export interface Society {
  id: string; // UUID
  slug: string; // e.g. "mahaveer-ranches"
  name: string; // e.g. "Mahaveer Ranches"
  code: string; // e.g. "MR2024" for join URL
  address: string;
  latitude: number;
  longitude: number;
  settings: SocietySettings;
  status: SocietyStatus;
  /** While PENDING_SETUP: the society admin's mobile (+91…); cleared once they sign in */
  pendingAdminMobile?: string;
  pendingAdminName?: string;
  /** Mobiles (+91…) invited to be admins of a live society; they become admins when they sign in */
  adminInvites?: string[];
  createdBy?: string;
  activatedAt?: string;
  createdAt: string;
}

/** Society fields safe to show to its members (no invite code or settings) */
export type SocietySummary = Pick<Society, 'id' | 'slug' | 'name' | 'address'>;

export type MembershipRole = 'RESIDENT' | 'SOCIETY_ADMIN' | 'SUPER_ADMIN';

export type MembershipStatus =
  | 'INVITED'
  | 'REGISTERED'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export interface User {
  id: string;
  cognitoSub: string;
  /** Firebase Auth UID linked at phone sign-in, when it differs from id */
  firebaseUid?: string;
  email: string;
  mobile: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  commuteIntent?: 'OFFERER' | 'SEEKER' | 'BOTH';
  defaultPersona?: 'OFFERER' | 'SEEKER' | 'SOCIETY_ADMIN' | 'APP_ADMIN';
  workLocationName?: string;
  workLatitude?: number;
  workLongitude?: number;
  profilePhotoUrl?: string;
  profileCompleted?: boolean;
  /** Set when the resident deleted their account; personal details are erased */
  deletedAt?: string;
  emailVerified?: boolean;
  createdAt: string;
}

export interface AdminPermissions {
  canApproveResidents?: boolean;
  canManageSettings?: boolean;
  canModerateReports?: boolean;
  canViewAuditLogs?: boolean;
  canApproveClasses?: boolean;
}

export interface SocietyMembership {
  id: string;
  societyId: string;
  userId: string;
  flatNumber: string;
  role: MembershipRole;
  permissions?: AdminPermissions;
  status: MembershipStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  /** Residents this member has hidden: their rides and requests stop showing to each other */
  hiddenUserIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type VehicleType = 'CAR' | 'SUV' | 'HATCHBACK' | 'SEDAN' | 'TWO_WHEELER';

export interface Vehicle {
  id: string;
  societyId: string;
  userId: string;
  type: VehicleType;
  make: string; // e.g. "Hyundai"
  model: string; // e.g. "Creta"
  color: string; // e.g. "Polar White"
  registrationNumber: string; // e.g. "KA-04-MB-1234"
  capacity: number; // e.g. 4
  mileageKmPerLitre?: number; // e.g. 15 km/L (used for advisory fuel share calculation)
  isActive: boolean;
  createdAt: string;
}

export type CommuteDirection = 'OUTBOUND_SOCIETY' | 'INBOUND_SOCIETY';
export type GenderPreference = 'ANY' | 'FEMALE_ONLY' | 'MALE_ONLY';
export type RideVisibility = 'SOCIETY_WIDE' | 'MATCH_ONLY';

export interface RideSchedule {
  id: string;
  societyId: string;
  userId: string;
  vehicleId: string;
  direction: CommuteDirection;
  originName: string;
  originLat: number;
  originLng: number;
  meetingPoint?: string;
  destinationName: string;
  destinationPlaceId?: string;
  destinationLat: number;
  destinationLng: number;
  departureWindowStart: string; // "08:00"
  departureWindowEnd: string; // "08:20"
  recurrenceDays: number[]; // 1=Mon … 7=Sun
  totalSeats: number;
  genderPreference: GenderPreference;
  visibility: RideVisibility;
  isActive: boolean;
  createdAt: string;
}

export type JourneyStatus =
  | 'OPEN'
  | 'PARTIALLY_BOOKED'
  | 'FULL'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface RideOccurrence {
  id: string;
  societyId: string;
  scheduleId?: string;
  offererUserId: string;
  vehicleId: string;
  journeyDate: string; // "YYYY-MM-DD"
  direction: CommuteDirection;
  departureWindowStart: string; // ISO
  departureWindowEnd: string; // ISO
  originName: string;
  originLat: number;
  originLng: number;
  /** Where riders meet the offerer, e.g. "Main Gate" (from the society's pick-up points or typed) */
  meetingPoint?: string;
  destinationName: string;
  destinationPlaceId?: string;
  destinationLat: number;
  destinationLng: number;
  baselineDurationMinutes: number;
  baselineDistanceKm: number;
  totalSeats: number;
  availableSeats: number;
  genderPreference: GenderPreference;
  visibility: RideVisibility;
  status: JourneyStatus;
  cancellationReason?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'WITHDRAWN';

export interface RideRequest {
  id: string;
  societyId: string;
  journeyId: string;
  seekerUserId: string;
  requestedSeats: number;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  calculatedDetourMinutes: number;
  status: RequestStatus;
  responseNote?: string;
  /** When the rider ended their trip, so the ride stops showing as upcoming */
  riderEndedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MatchQualityLabel = 'EXCELLENT' | 'GOOD' | 'POSSIBLE';

export interface CommuteMatch {
  id: string;
  societyId: string;
  journeyId: string;
  seekerUserId: string;
  qualityScore: number; // 0-100
  qualityLabel: MatchQualityLabel;
  detourMinutes: number;
  timeOverlapMinutes: number;
  status: 'NEW' | 'NOTIFIED' | 'DISMISSED' | 'REQUESTED';
  createdAt: string;
}

export type JourneyOutcome =
  | 'COMPLETED'
  | 'DRIVER_CANCELLED'
  | 'PASSENGER_CANCELLED'
  | 'PASSENGER_NO_SHOW'
  | 'DRIVER_NO_SHOW'
  | 'OTHER';

export interface Feedback {
  id: string;
  societyId: string;
  journeyId: string;
  fromUserId: string;
  toUserId: string;
  role: 'OFFERER' | 'SEEKER';
  outcome: JourneyOutcome;
  qualitativeTags: string[]; // e.g. ["Punctual & Reliable", "Comfortable Ride"]
  privateNote?: string;
  createdAt: string;
}

export interface ModerationReport {
  id: string;
  societyId: string;
  journeyId?: string;
  reporterId: string;
  reportedUserId: string;
  category:
    | 'INAPPROPRIATE_BEHAVIOUR'
    | 'MISREPRESENTATION'
    | 'REPEATED_CANCELLATION'
    | 'NO_SHOW'
    | 'SAFETY_CONCERN'
    | 'HARASSMENT'
    | 'OTHER';
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  resolutionNotes?: string;
  resolvedBy?: string;
  createdAt: string;
}

/** A browser or phone that receives push notifications for a user */
export interface PushDevice {
  /** sha256 of the token */
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  lastSeenAt: string;
}

/** A resident told a class's teacher they are interested; only the teacher sees who */
export interface ClassInterest {
  id: string;
  societyId: string;
  listingId: string;
  userId: string;
  createdAt: string;
}

/** A society notice from its admins, shown on Home */
export interface Announcement {
  id: string;
  societyId: string;
  title: string;
  body: string;
  createdBy: string;
  /** Who it is from, as residents see it, e.g. "Vikram Mehta, Society admin" or "Management committee" */
  fromName?: string;
  createdAt: string;
  /** Hidden after this date (YYYY-MM-DD, IST), if set */
  expiresOn?: string;
}

/** A resident's suggestion or problem report about how a module is set up in their society */
export type SuggestionModule = 'RIDESHARE' | 'CLASSES' | 'GENERAL';
export interface SocietySuggestion {
  id: string;
  societyId: string;
  userId: string;
  userName: string;
  module: SuggestionModule;
  kind: 'SUGGESTION' | 'REPORT';
  message: string;
  status: 'OPEN' | 'DONE';
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface AuditEvent {
  id: string;
  societyId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface InAppNotification {
  id: string;
  societyId: string;
  userId: string;
  title: string;
  body: string;
  type:
    | 'MATCH_FOUND'
    | 'RIDE_REQUESTED'
    | 'REQUEST_ACCEPTED'
    | 'REQUEST_REJECTED'
    | 'RIDE_CANCELLED'
    | 'RIDE_STARTED'
    | 'RIDE_COMPLETED'
    | 'SOS_ALERT'
    | 'GENERAL';
  link?: string;
  read: boolean;
  createdAt: string;
}

// Client-safe views with privacy-conscious unmasking
export interface PublicOffererProfile {
  id: string;
  displayName: string; // e.g. "Ashutosh D."
  verificationBadge: 'Verified Resident';
  workLocation?: string;
  flatNumber?: string; // Only present if accepted
  mobile?: string; // Only present if accepted
  photoUrl?: string; // Only present if accepted
}

export interface PublicVehicleView {
  make: string;
  model: string;
  color: string;
  type: VehicleType;
  registrationNumber?: string; // Only present if accepted
}

/** A resident's track record from ratings after shared rides */
export interface Reputation {
  /** Rides others confirmed as completed with this person */
  rides: number;
  /** Share of rated rides where this person turned up as agreed (0-100), once there are enough ratings */
  reliablePercent: number | null;
  /** The compliments they get most often */
  topTags: string[];
}

export interface PublicJourneyView {
  id: string;
  journeyDate: string;
  direction: CommuteDirection;
  departureWindowStart: string;
  departureWindowEnd: string;
  originName: string;
  meetingPoint?: string;
  destinationName: string;
  totalSeats: number;
  availableSeats: number;
  genderPreference: GenderPreference;
  offerer: PublicOffererProfile;
  offererReputation?: Reputation;
  vehicle: PublicVehicleView;
  status: JourneyStatus;
  userRequestStatus?: RequestStatus;
  baselineDistanceKm?: number;
  fuelSharePointsEstimate?: {
    totalFuelCost: number; // in INR
    perPassengerPoints: number; // 1 Point = 1 INR
    fuelPricePerLitre: number;
    vehicleMileageKmPerLitre: number;
    disclaimer: string;
  };
}

// ── Lessons / Classes Module ──────────────────────────────

export type ClassType = 'ONE_TIME' | 'FESTIVE' | 'REGULAR';

export type FeeType = 'FREE' | 'PER_SESSION' | 'PER_MONTH' | 'PER_COURSE';

export type ClassStatus =
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'FULL'
  | 'DEACTIVATED'
  | 'EXPIRED'
  | 'REJECTED';

export type LocationType = 'CLUBHOUSE' | 'FLAT' | 'OTHER';

export interface ClassListing {
  id: string;
  societyId: string;
  createdByUserId: string;
  /** In the teacher's own list only: how many neighbours said they're interested */
  interestedCount?: number;

  // Core Details
  classType: ClassType;
  subject: string;
  isCustomSubject?: boolean;
  description: string;

  // Fee Details (informational only, settled in-person)
  feeType: FeeType;
  feeAmount?: number;

  // Contact (pre-filled from user, editable)
  contactName: string;
  contactPhone: string;

  // Location Details
  locationType: LocationType;
  locationDetail?: string; // e.g. "Clubhouse Multipurpose Hall" or "Tower B - 804"

  // Age Requirements
  ageMin?: number;
  ageMax?: number;
  noAgeLimit: boolean;

  // Schedule Details
  scheduleDays: string[]; // e.g. ['MON', 'WED', 'FRI'] or ['FLEXIBLE']
  startTime?: string; // e.g. "06:00", "17:30" (in 30 min intervals)
  durationMinutes?: number; // 30, 60, 90, 120, up to 480

  // Trial & Expiry
  trialAvailable: boolean;
  expiresOn?: string; // ISO date string

  // Media
  photoUrl?: string;

  // Approval & Status
  status: ClassStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;

  // Creator profile snapshot for rendering
  creatorName?: string;
  creatorFlat?: string;

  createdAt: string;
  updatedAt: string;
}
