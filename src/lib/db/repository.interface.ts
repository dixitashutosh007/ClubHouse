import {
  Society,
  User,
  SocietyMembership,
  Vehicle,
  RideSchedule,
  RideOccurrence,
  RideRequest,
  CommuteMatch,
  Feedback,
  ModerationReport,
  SocietySuggestion,
  AuditEvent,
  InAppNotification,
  ClassListing,
  ClassStatus,
  ClassType,
} from '@/types';
import { BookingResult, RideCancellationResult } from '@/lib/services/seat-booking';

/**
 * SocietyApps Multi-Tenant Repository Interface
 * Enforces strict societyId isolation across all operations.
 */
export interface ISocietyRepository {
  // Societies
  getSocietyById(societyId: string): Promise<Society | null>;
  getSocietyByCode(code: string): Promise<Society | null>;
  listSocieties(): Promise<Society[]>;
  createSociety(society: Society): Promise<Society>;
  updateSociety(societyId: string, updates: Partial<Society>): Promise<Society>;
  updateSocietySettings(
    societyId: string,
    settings: Partial<Society['settings']>
  ): Promise<Society>;

  // Users & Memberships
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByPhone(mobile: string): Promise<User | null>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | null>;
  createUser(user: User): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;

  getMembership(societyId: string, userId: string): Promise<SocietyMembership | null>;
  /** Every society membership the user holds, in any status */
  listUserMemberships(userId: string): Promise<SocietyMembership[]>;
  createMembership(membership: SocietyMembership): Promise<SocietyMembership>;
  updateMembership(
    societyId: string,
    userId: string,
    updates: Partial<SocietyMembership>
  ): Promise<SocietyMembership>;
  updateMembershipStatus(
    societyId: string,
    userId: string,
    status: SocietyMembership['status'],
    adminUserId: string,
    reason?: string
  ): Promise<SocietyMembership>;
  listPendingMemberships(societyId: string): Promise<(SocietyMembership & { user: User })[]>;
  listSocietyMembers(societyId: string): Promise<(SocietyMembership & { user: User })[]>;

  // Vehicles
  createVehicle(vehicle: Vehicle): Promise<Vehicle>;
  getVehicleById(societyId: string, vehicleId: string): Promise<Vehicle | null>;
  listUserVehicles(societyId: string, userId: string): Promise<Vehicle[]>;

  // Ride Schedules (Recurring)
  createRideSchedule(schedule: RideSchedule): Promise<RideSchedule>;
  listUserSchedules(societyId: string, userId: string): Promise<RideSchedule[]>;
  deactivateSchedule(societyId: string, scheduleId: string, userId: string): Promise<void>;
  getRideSchedule(societyId: string, scheduleId: string): Promise<RideSchedule | null>;
  /** Every repeating ride still switched on in the society */
  listActiveSchedules(societyId: string): Promise<RideSchedule[]>;

  // Ride Occurrences (Individual Journeys)
  createRideOccurrence(occurrence: RideOccurrence): Promise<RideOccurrence>;
  getRideOccurrence(societyId: string, journeyId: string): Promise<RideOccurrence | null>;
  listOpenRides(
    societyId: string,
    date?: string,
    direction?: RideOccurrence['direction']
  ): Promise<RideOccurrence[]>;
  listUserRides(societyId: string, userId: string): Promise<RideOccurrence[]>;
  /** Rides not yet finished (open, booked, full or under way), any date */
  listActiveRides(societyId: string): Promise<RideOccurrence[]>;
  updateRideOccurrence(
    societyId: string,
    journeyId: string,
    userId: string,
    updates: Partial<RideOccurrence>
  ): Promise<RideOccurrence>;
  /** Cancels the ride and all its pending or accepted requests atomically */
  cancelRideWithRequests(
    societyId: string,
    journeyId: string,
    offererUserId: string,
    reason: string
  ): Promise<RideCancellationResult>;

  // Ride Requests
  createRideRequest(request: RideRequest): Promise<RideRequest>;
  getRideRequest(societyId: string, requestId: string): Promise<RideRequest | null>;
  listJourneyRequests(societyId: string, journeyId: string): Promise<RideRequest[]>;
  listUserRequests(societyId: string, userId: string): Promise<RideRequest[]>;
  /** Offerer accepts a request; seat check and decrement are atomic */
  acceptRideRequest(
    societyId: string,
    requestId: string,
    offererUserId: string,
    note?: string
  ): Promise<BookingResult>;
  /** Offerer rejects or seeker cancels a request, releasing any held seats atomically */
  closeRideRequest(
    societyId: string,
    requestId: string,
    actor: { userId: string; as: 'OFFERER' | 'SEEKER' },
    note?: string
  ): Promise<BookingResult>;

  // Matches
  saveMatch(match: CommuteMatch): Promise<CommuteMatch>;
  listUserMatches(societyId: string, userId: string): Promise<CommuteMatch[]>;

  // Feedback & Moderation
  createFeedback(feedback: Feedback): Promise<Feedback>;
  listUserFeedbackReceived(societyId: string, userId: string): Promise<Feedback[]>;
  createModerationReport(report: ModerationReport): Promise<ModerationReport>;
  listModerationReports(societyId: string): Promise<ModerationReport[]>;
  updateModerationReportStatus(
    societyId: string,
    reportId: string,
    status: ModerationReport['status'],
    resolutionNotes?: string,
    adminUserId?: string
  ): Promise<ModerationReport | null>;

  // Residents' suggestions about society configuration
  createSuggestion(suggestion: SocietySuggestion): Promise<SocietySuggestion>;
  listSuggestions(societyId: string): Promise<SocietySuggestion[]>;
  updateSuggestion(
    societyId: string,
    suggestionId: string,
    updates: Partial<Pick<SocietySuggestion, 'status' | 'resolvedBy' | 'resolvedAt'>>
  ): Promise<SocietySuggestion | null>;

  /**
   * Counts one request against a fixed window shared by every server
   * instance; returns the count so far and when the window ends (ms)
   */
  hitRateLimit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;

  // Auditing
  recordAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(societyId: string): Promise<AuditEvent[]>;

  // In-App & Push Notifications
  createNotification(notification: InAppNotification): Promise<InAppNotification>;
  listUserNotifications(societyId: string, userId: string): Promise<InAppNotification[]>;
  /** Returns false when the notification does not exist or belongs to someone else */
  markNotificationAsRead(societyId: string, notificationId: string, userId: string): Promise<boolean>;
  markAllNotificationsAsRead(societyId: string, userId: string): Promise<void>;

  // Lessons / Classes
  createClassListing(listing: ClassListing): Promise<ClassListing>;
  getClassListing(societyId: string, listingId: string): Promise<ClassListing | null>;
  listActiveClasses(
    societyId: string,
    subject?: string,
    classType?: ClassType
  ): Promise<ClassListing[]>;
  listPendingClasses(societyId: string): Promise<ClassListing[]>;
  listUserClasses(societyId: string, userId: string): Promise<ClassListing[]>;
  updateClassListing(
    societyId: string,
    listingId: string,
    userId: string,
    updates: Partial<ClassListing>
  ): Promise<ClassListing>;
  updateClassStatus(
    societyId: string,
    listingId: string,
    status: ClassStatus,
    actorUserId: string,
    reason?: string
  ): Promise<ClassListing>;
  deleteClassListing(societyId: string, listingId: string, userId: string): Promise<void>;
}
