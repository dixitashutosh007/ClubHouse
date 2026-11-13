import { createHash } from 'crypto';
import { ISocietyRepository } from './repository.interface';
import { adminDb } from '../firebase/admin';
import {
  DocumentData,
  FieldValue,
  QueryDocumentSnapshot,
  Transaction,
  Query,
} from 'firebase-admin/firestore';
import {
  BookingResult,
  RideCancellationResult,
  planAccept,
  planCancelRide,
  planClose,
} from '@/lib/services/seat-booking';
import { istDateString } from '@/lib/utils/time';
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
  PushDevice,
  AuditEvent,
  InAppNotification,
  ClassListing,
  ClassStatus,
  ClassType,
} from '@/types';

/**
 * Turns a partial update into a Firestore update: a field set to undefined is
 * removed from the document (as in the mock repository) rather than rejected.
 */
export function toFirestoreUpdate(updates: object): DocumentData {
  return Object.fromEntries(
    Object.entries(updates).map(([key, value]) => [key, value === undefined ? FieldValue.delete() : value])
  );
}

/**
 * Google Cloud Firestore Repository Implementation
 * Stores all entities in isolated Firestore collections and sub-collections:
 *  - /societies/{societyId}
 *  - /users/{userId}
 *  - /societies/{societyId}/members/{userId}
 *  - /societies/{societyId}/vehicles/{vehicleId}
 *  - /societies/{societyId}/schedules/{scheduleId}
 *  - /societies/{societyId}/occurrences/{journeyId}
 *  - /societies/{societyId}/requests/{requestId}
 *  - /societies/{societyId}/matches/{matchId}
 *  - /societies/{societyId}/notifications/{notifId}
 *  - /societies/{societyId}/feedback/{feedbackId}
 *  - /societies/{societyId}/moderation_reports/{reportId}
 *  - /audit_events/{eventId}
 */
export class FirestoreRepository implements ISocietyRepository {
  private db = adminDb;

  // Societies
  async getSocietyById(societyId: string): Promise<Society | null> {
    const doc = await this.db.collection('societies').doc(societyId).get();
    if (!doc.exists) return null;
    return doc.data() as Society;
  }

  async getSocietyByCode(code: string): Promise<Society | null> {
    const snap = await this.db
      .collection('societies')
      .where('code', '==', code.toUpperCase())
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Society;
  }

  async listSocieties(): Promise<Society[]> {
    const snap = await this.db.collection('societies').get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as Society);
  }

  async createSociety(society: Society): Promise<Society> {
    await this.db.collection('societies').doc(society.id).set(society);
    return society;
  }

  async updateSociety(societyId: string, updates: Partial<Society>): Promise<Society> {
    await this.db.collection('societies').doc(societyId).update(toFirestoreUpdate(updates));
    const updated = await this.getSocietyById(societyId);
    if (!updated) throw new Error('Society not found');
    return updated;
  }

  async updateSocietySettings(
    societyId: string,
    settings: Partial<Society['settings']>
  ): Promise<Society> {
    const ref = this.db.collection('societies').doc(societyId);
    const existing = await ref.get();
    if (!existing.exists) throw new Error('Society not found');
    const curr = existing.data() as Society;
    // The whole map is written, so a setting cleared to undefined is removed
    const mergedSettings = Object.fromEntries(
      Object.entries({ ...curr.settings, ...settings }).filter(([, value]) => value !== undefined)
    ) as unknown as Society['settings'];
    await ref.update({ settings: mergedSettings });
    return { ...curr, settings: mergedSettings };
  }

  // Users & Memberships
  async getUserById(userId: string): Promise<User | null> {
    const doc = await this.db.collection('users').doc(userId).get();
    if (!doc.exists) return null;
    return doc.data() as User;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const snap = await this.db
      .collection('users')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as User;
  }

  async getUserByPhone(mobile: string): Promise<User | null> {
    const snap = await this.db
      .collection('users')
      .where('mobile', '==', mobile)
      .limit(1)
      .get();
    if (snap.empty) {
      // Also try with/without leading +91
      const normalized = mobile.startsWith('+91') ? mobile.replace('+91', '') : `+91${mobile}`;
      const snap2 = await this.db
        .collection('users')
        .where('mobile', '==', normalized)
        .limit(1)
        .get();
      if (snap2.empty) return null;
      return snap2.docs[0].data() as User;
    }
    return snap.docs[0].data() as User;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const snap = await this.db
      .collection('users')
      .where('firebaseUid', '==', firebaseUid)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as User;
  }

  async createUser(user: User): Promise<User> {
    await this.db.collection('users').doc(user.id).set(user);
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    await this.db.collection('users').doc(userId).update(toFirestoreUpdate(updates));
    const updated = await this.getUserById(userId);
    if (!updated) throw new Error('User not found');
    return updated;
  }

  async getMembership(societyId: string, userId: string): Promise<SocietyMembership | null> {
    const doc = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('members')
      .doc(userId)
      .get();
    if (!doc.exists) return null;
    return doc.data() as SocietyMembership;
  }

  async listUserMemberships(userId: string): Promise<SocietyMembership[]> {
    // Collection-group query; needs the members.userId override in firestore.indexes.json
    const snap = await this.db.collectionGroup('members').where('userId', '==', userId).get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as SocietyMembership);
  }

  async createMembership(membership: SocietyMembership): Promise<SocietyMembership> {
    await this.db
      .collection('societies')
      .doc(membership.societyId)
      .collection('members')
      .doc(membership.userId)
      .set(membership);
    return membership;
  }

  async updateMembership(
    societyId: string,
    userId: string,
    updates: Partial<SocietyMembership>
  ): Promise<SocietyMembership> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('members')
      .doc(userId);
    await ref.update(toFirestoreUpdate({ ...updates, updatedAt: new Date().toISOString() }));
    const updated = await this.getMembership(societyId, userId);
    if (!updated) throw new Error('Membership not found');
    return updated;
  }

  async updateMembershipStatus(
    societyId: string,
    userId: string,
    status: SocietyMembership['status'],
    adminUserId: string,
    reason?: string
  ): Promise<SocietyMembership> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('members')
      .doc(userId);
    const updates: Partial<SocietyMembership> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (status === 'ACTIVE') {
      updates.approvedBy = adminUserId;
      updates.approvedAt = new Date().toISOString();
    }
    if (reason) updates.rejectionReason = reason;

    await ref.update(toFirestoreUpdate(updates));
    const updated = await ref.get();
    return updated.data() as SocietyMembership;
  }

  async listPendingMemberships(societyId: string): Promise<(SocietyMembership & { user: User })[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('members')
      .where('status', '==', 'PENDING_APPROVAL')
      .get();

    const results: (SocietyMembership & { user: User })[] = [];
    for (const d of snap.docs) {
      const mem = d.data() as SocietyMembership;
      const user = await this.getUserById(mem.userId);
      if (user) results.push({ ...mem, user });
    }
    return results;
  }

  async listSocietyMembers(societyId: string): Promise<(SocietyMembership & { user: User })[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('members')
      .get();

    const results: (SocietyMembership & { user: User })[] = [];
    for (const d of snap.docs) {
      const mem = d.data() as SocietyMembership;
      const user = await this.getUserById(mem.userId);
      if (user) results.push({ ...mem, user });
    }
    return results;
  }

  // Vehicles
  async updateVehicle(societyId: string, vehicleId: string, updates: Partial<Vehicle>): Promise<void> {
    await this.db
      .collection('societies')
      .doc(societyId)
      .collection('vehicles')
      .doc(vehicleId)
      .update(toFirestoreUpdate(updates));
  }

  async createVehicle(vehicle: Vehicle): Promise<Vehicle> {
    await this.db
      .collection('societies')
      .doc(vehicle.societyId)
      .collection('vehicles')
      .doc(vehicle.id)
      .set(vehicle);
    return vehicle;
  }

  async getVehicleById(societyId: string, vehicleId: string): Promise<Vehicle | null> {
    const doc = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('vehicles')
      .doc(vehicleId)
      .get();
    if (!doc.exists) return null;
    return doc.data() as Vehicle;
  }

  async listUserVehicles(societyId: string, userId: string, includeInactive = false): Promise<Vehicle[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('vehicles')
      .where('userId', '==', userId)
      .get();
    // Removed vehicles stay stored for past rides but are not listed (matches the mock repository)
    return snap.docs
      .map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as Vehicle)
      .filter((v: Vehicle) => includeInactive || v.isActive !== false);
  }

  // Ride Schedules
  async createRideSchedule(schedule: RideSchedule): Promise<RideSchedule> {
    await this.db
      .collection('societies')
      .doc(schedule.societyId)
      .collection('schedules')
      .doc(schedule.id)
      .set(schedule);
    return schedule;
  }

  async listUserSchedules(societyId: string, userId: string): Promise<RideSchedule[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('schedules')
      .where('userId', '==', userId)
      .get();
    // Stopped schedules are kept for history but not listed (matches the mock repository)
    return snap.docs
      .map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as RideSchedule)
      .filter((s: RideSchedule) => s.isActive);
  }

  async getRideSchedule(societyId: string, scheduleId: string): Promise<RideSchedule | null> {
    const doc = await this.db.collection('societies').doc(societyId).collection('schedules').doc(scheduleId).get();
    return doc.exists ? (doc.data() as RideSchedule) : null;
  }

  async listActiveSchedules(societyId: string): Promise<RideSchedule[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('schedules')
      .where('isActive', '==', true)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as RideSchedule);
  }

  async listActiveRides(societyId: string): Promise<RideOccurrence[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('occurrences')
      .where('status', 'in', ['OPEN', 'PARTIALLY_BOOKED', 'FULL', 'IN_PROGRESS'])
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as RideOccurrence);
  }

  async deactivateSchedule(societyId: string, scheduleId: string, userId: string): Promise<void> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('schedules')
      .doc(scheduleId);
    // Only the schedule's owner can deactivate it (matches the mock repository)
    const doc = await ref.get();
    if (!doc.exists || (doc.data() as RideSchedule).userId !== userId) return;
    await ref.update({ isActive: false });
  }

  // Ride Occurrences
  async createRideOccurrence(occurrence: RideOccurrence): Promise<RideOccurrence> {
    await this.db
      .collection('societies')
      .doc(occurrence.societyId)
      .collection('occurrences')
      .doc(occurrence.id)
      .set(occurrence);
    return occurrence;
  }

  async getRideOccurrence(societyId: string, journeyId: string): Promise<RideOccurrence | null> {
    const doc = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('occurrences')
      .doc(journeyId)
      .get();
    if (!doc.exists) return null;
    return doc.data() as RideOccurrence;
  }

  async listOpenRides(
    societyId: string,
    date?: string,
    direction?: RideOccurrence['direction']
  ): Promise<RideOccurrence[]> {
    let query: Query = this.db
      .collection('societies')
      .doc(societyId)
      .collection('occurrences')
      .where('status', 'in', ['OPEN', 'PARTIALLY_BOOKED']);

    // FULL rides are hidden: seekers can only request rides with free seats

    if (direction) {
      query = query.where('direction', '==', direction);
    }

    const snap = await query.get();
    let rides = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as RideOccurrence);

    const todayStr = istDateString();
    if (date && date !== 'ALL') {
      rides = rides.filter((r: RideOccurrence) => r.journeyDate === date);
    } else {
      rides = rides.filter((r: RideOccurrence) => r.journeyDate >= todayStr);
    }

    return rides.sort((a: RideOccurrence, b: RideOccurrence) =>
      a.journeyDate.localeCompare(b.journeyDate)
    );
  }

  async listUserRides(societyId: string, userId: string): Promise<RideOccurrence[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('occurrences')
      .where('offererUserId', '==', userId)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as RideOccurrence);
  }

  async updateRideOccurrence(
    societyId: string,
    journeyId: string,
    userId: string,
    updates: Partial<RideOccurrence>
  ): Promise<RideOccurrence> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('occurrences')
      .doc(journeyId);
    await ref.update(toFirestoreUpdate(updates));
    const doc = await ref.get();
    return doc.data() as RideOccurrence;
  }

  async cancelRideWithRequests(
    societyId: string,
    journeyId: string,
    offererUserId: string,
    reason: string
  ): Promise<RideCancellationResult> {
    const societyRef = this.db.collection('societies').doc(societyId);
    const journeyRef = societyRef.collection('occurrences').doc(journeyId);
    const requestsQuery = societyRef.collection('requests').where('journeyId', '==', journeyId);

    return this.db.runTransaction(async (tx: Transaction) => {
      const journeySnap = await tx.get(journeyRef);
      const requestsSnap = await tx.get(requestsQuery);
      const journey = journeySnap.exists ? (journeySnap.data() as RideOccurrence) : null;
      const requests = requestsSnap.docs.map((d) => d.data() as RideRequest);

      const result = planCancelRide(journey, requests, offererUserId, reason, new Date().toISOString());
      if (result.ok) {
        tx.set(journeyRef, result.journey);
        for (const r of result.affectedRequests) {
          tx.set(societyRef.collection('requests').doc(r.id), r);
        }
      }
      return result;
    });
  }

  // Ride Requests
  async createRideRequest(request: RideRequest): Promise<RideRequest> {
    await this.db
      .collection('societies')
      .doc(request.societyId)
      .collection('requests')
      .doc(request.id)
      .set(request);
    return request;
  }

  async getRideRequest(societyId: string, requestId: string): Promise<RideRequest | null> {
    const doc = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('requests')
      .doc(requestId)
      .get();
    if (!doc.exists) return null;
    return doc.data() as RideRequest;
  }

  async listJourneyRequests(societyId: string, journeyId: string): Promise<RideRequest[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('requests')
      .where('journeyId', '==', journeyId)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as RideRequest);
  }

  async listUserRequests(societyId: string, userId: string): Promise<RideRequest[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('requests')
      .where('seekerUserId', '==', userId)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as RideRequest);
  }

  async acceptRideRequest(
    societyId: string,
    requestId: string,
    offererUserId: string,
    note?: string
  ): Promise<BookingResult> {
    return this.applyBooking(societyId, requestId, (journey, request, now) =>
      planAccept(journey, request, offererUserId, note, now)
    );
  }

  async closeRideRequest(
    societyId: string,
    requestId: string,
    actor: { userId: string; as: 'OFFERER' | 'SEEKER' },
    note?: string
  ): Promise<BookingResult> {
    return this.applyBooking(societyId, requestId, (journey, request, now) =>
      planClose(journey, request, actor, note, now)
    );
  }

  /**
   * Reads the request and its journey in one transaction, applies the
   * booking plan and writes both back, so concurrent accepts can't
   * oversell seats (Firestore retries the transaction on conflict).
   */
  private applyBooking(
    societyId: string,
    requestId: string,
    plan: (journey: RideOccurrence | null, request: RideRequest | null, now: string) => BookingResult
  ): Promise<BookingResult> {
    const societyRef = this.db.collection('societies').doc(societyId);
    const requestRef = societyRef.collection('requests').doc(requestId);

    return this.db.runTransaction(async (tx: Transaction) => {
      const requestSnap = await tx.get(requestRef);
      const request = requestSnap.exists ? (requestSnap.data() as RideRequest) : null;
      const journeyRef = request ? societyRef.collection('occurrences').doc(request.journeyId) : null;
      const journeySnap = journeyRef ? await tx.get(journeyRef) : null;
      const journey = journeySnap?.exists ? (journeySnap.data() as RideOccurrence) : null;

      const result = plan(journey, request, new Date().toISOString());
      if (result.ok && journeyRef) {
        tx.set(journeyRef, result.journey);
        tx.set(requestRef, result.request);
      }
      return result;
    });
  }

  // Matches
  async saveMatch(match: CommuteMatch): Promise<CommuteMatch> {
    await this.db
      .collection('societies')
      .doc(match.societyId)
      .collection('matches')
      .doc(match.id)
      .set(match);
    return match;
  }

  async listUserMatches(societyId: string, userId: string): Promise<CommuteMatch[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('matches')
      .where('seekerUserId', '==', userId)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as CommuteMatch);
  }

  // Feedback & Moderation
  async createFeedback(feedback: Feedback): Promise<Feedback> {
    await this.db
      .collection('societies')
      .doc(feedback.societyId)
      .collection('feedback')
      .doc(feedback.id)
      .set(feedback);
    return feedback;
  }

  async listUserFeedbackReceived(societyId: string, userId: string): Promise<Feedback[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('feedback')
      .where('toUserId', '==', userId)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as Feedback);
  }

  async createModerationReport(report: ModerationReport): Promise<ModerationReport> {
    await this.db
      .collection('societies')
      .doc(report.societyId)
      .collection('moderation_reports')
      .doc(report.id)
      .set(report);
    return report;
  }

  async listModerationReports(societyId: string): Promise<ModerationReport[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('moderation_reports')
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as ModerationReport);
  }

  async updateModerationReportStatus(
    societyId: string,
    reportId: string,
    status: ModerationReport['status'],
    resolutionNotes?: string,
    adminUserId?: string
  ): Promise<ModerationReport | null> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('moderation_reports')
      .doc(reportId);
    if (!(await ref.get()).exists) return null;
    const updates: Partial<ModerationReport> = { status };
    if (resolutionNotes) updates.resolutionNotes = resolutionNotes;
    if (adminUserId) updates.resolvedBy = adminUserId;
    await ref.update(toFirestoreUpdate(updates));
    const doc = await ref.get();
    return doc.data() as ModerationReport;
  }

  // Residents' suggestions about society configuration
  private suggestionsCol(societyId: string) {
    return this.db.collection('societies').doc(societyId).collection('suggestions');
  }

  async createSuggestion(suggestion: SocietySuggestion): Promise<SocietySuggestion> {
    await this.suggestionsCol(suggestion.societyId).doc(suggestion.id).set(suggestion);
    return suggestion;
  }

  async listSuggestions(societyId: string): Promise<SocietySuggestion[]> {
    const snap = await this.suggestionsCol(societyId).orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as SocietySuggestion);
  }

  async updateSuggestion(
    societyId: string,
    suggestionId: string,
    updates: Partial<Pick<SocietySuggestion, 'status' | 'resolvedBy' | 'resolvedAt'>>
  ): Promise<SocietySuggestion | null> {
    const ref = this.suggestionsCol(societyId).doc(suggestionId);
    if (!(await ref.get()).exists) return null;
    await ref.update(toFirestoreUpdate(updates));
    return (await ref.get()).data() as SocietySuggestion;
  }

  async savePushDevice(device: PushDevice): Promise<void> {
    const ref = this.db.collection('push_devices').doc(device.id);
    const existing = await ref.get();
    await ref.set(existing.exists ? { ...device, createdAt: (existing.data() as PushDevice).createdAt } : device);
  }

  async listPushDevices(userId: string): Promise<PushDevice[]> {
    const snap = await this.db.collection('push_devices').where('userId', '==', userId).get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as PushDevice);
  }

  async deletePushDevice(id: string): Promise<void> {
    await this.db.collection('push_devices').doc(id).delete();
  }

  async hitRateLimit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }> {
    // Keys contain user IDs and IPs; store a hash so document IDs stay safe and short
    const id = createHash('sha256').update(key).digest('hex');
    const ref = this.db.collection('rate_limits').doc(id);
    return this.db.runTransaction(async (tx: Transaction) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? (doc.data() as { count: number; resetAt: number }) : null;
      const window =
        !data || data.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { count: data.count + 1, resetAt: data.resetAt };
      // expireAt lets a Firestore TTL policy delete old windows
      tx.set(ref, { ...window, expireAt: new Date(window.resetAt + 60 * 60 * 1000) });
      return window;
    });
  }

  // Auditing
  async recordAuditEvent(event: AuditEvent): Promise<void> {
    await this.db.collection('audit_events').doc(event.id).set(event);
  }

  async listAuditEvents(societyId: string): Promise<AuditEvent[]> {
    const snap = await this.db
      .collection('audit_events')
      .where('societyId', '==', societyId)
      // Newest 100 events; needs the composite index in firestore.indexes.json
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as AuditEvent);
  }

  // In-App & Push Notifications
  async createNotification(notification: InAppNotification): Promise<InAppNotification> {
    await this.db
      .collection('societies')
      .doc(notification.societyId)
      .collection('notifications')
      .doc(notification.id)
      .set(notification);
    return notification;
  }

  async listUserNotifications(societyId: string, userId: string): Promise<InAppNotification[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('notifications')
      .where('userId', '==', userId)
      .get();
    const list = snap.docs.map(
      (d: QueryDocumentSnapshot<DocumentData>) => d.data() as InAppNotification
    );
    return list.sort(
      (a: InAppNotification, b: InAppNotification) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async markNotificationAsRead(
    societyId: string,
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('notifications')
      .doc(notificationId);
    const doc = await ref.get();
    if (!doc.exists || (doc.data() as InAppNotification).userId !== userId) return false;
    await ref.update({ read: true });
    return true;
  }

  async markAllNotificationsAsRead(societyId: string, userId: string): Promise<void> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    const batch = this.db.batch();
    for (const d of snap.docs) {
      batch.update(d.ref, { read: true });
    }
    await batch.commit();
  }

  // Lessons / Classes
  async createClassListing(listing: ClassListing): Promise<ClassListing> {
    await this.db
      .collection('societies')
      .doc(listing.societyId)
      .collection('lessons')
      .doc(listing.id)
      .set(listing);
    return listing;
  }

  async getClassListing(societyId: string, listingId: string): Promise<ClassListing | null> {
    const doc = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('lessons')
      .doc(listingId)
      .get();
    if (!doc.exists) return null;
    return doc.data() as ClassListing;
  }

  async listActiveClasses(
    societyId: string,
    subject?: string,
    classType?: ClassType
  ): Promise<ClassListing[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('lessons')
      .get();

    let list = snap.docs
      .map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as ClassListing)
      .filter((c: ClassListing) => c.status === 'ACTIVE' || c.status === 'FULL');

    if (subject && subject !== 'ALL') {
      list = list.filter((c: ClassListing) => c.subject.toLowerCase() === subject.toLowerCase());
    }
    if (classType) {
      list = list.filter((c: ClassListing) => c.classType === classType);
    }

    return list.sort(
      (a: ClassListing, b: ClassListing) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async listPendingClasses(societyId: string): Promise<ClassListing[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('lessons')
      .where('status', '==', 'PENDING_APPROVAL')
      .get();

    const list = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as ClassListing);
    return list.sort(
      (a: ClassListing, b: ClassListing) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async listUserClasses(societyId: string, userId: string): Promise<ClassListing[]> {
    const snap = await this.db
      .collection('societies')
      .doc(societyId)
      .collection('lessons')
      .where('createdByUserId', '==', userId)
      .get();

    const list = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data() as ClassListing);
    return list.sort(
      (a: ClassListing, b: ClassListing) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateClassListing(
    societyId: string,
    listingId: string,
    userId: string,
    updates: Partial<ClassListing>
  ): Promise<ClassListing> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('lessons')
      .doc(listingId);

    const doc = await ref.get();
    if (!doc.exists) {
      throw new Error(`Class listing not found: ${listingId}`);
    }
    const existing = doc.data() as ClassListing;
    if (existing.createdByUserId !== userId) {
      throw new Error('Unauthorized to modify this class listing');
    }

    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    // Fields set to undefined (e.g. a removed photo) are deleted from the document
    await ref.update(toFirestoreUpdate(payload));
    return { ...existing, ...payload };
  }

  async updateClassStatus(
    societyId: string,
    listingId: string,
    status: ClassStatus,
    actorUserId: string,
    reason?: string
  ): Promise<ClassListing> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('lessons')
      .doc(listingId);

    const doc = await ref.get();
    if (!doc.exists) {
      throw new Error(`Class listing not found: ${listingId}`);
    }
    const existing = doc.data() as ClassListing;

    const payload: Partial<ClassListing> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (status === 'ACTIVE') {
      payload.approvedBy = actorUserId;
      payload.approvedAt = new Date().toISOString();
      payload.rejectionReason = undefined;
    } else if (status === 'REJECTED') {
      payload.rejectionReason = reason || 'Declined by society admin';
    }

    await ref.update(toFirestoreUpdate(payload));
    return { ...existing, ...payload };
  }

  async deleteClassListing(societyId: string, listingId: string, userId: string): Promise<void> {
    const ref = this.db
      .collection('societies')
      .doc(societyId)
      .collection('lessons')
      .doc(listingId);

    const doc = await ref.get();
    if (!doc.exists) return;
    const existing = doc.data() as ClassListing;
    if (existing.createdByUserId !== userId) {
      throw new Error('Unauthorized to delete this class listing');
    }
    await ref.delete();
  }
}
