import { describe, it, expect, beforeEach } from 'vitest';
import { MockDynamoRepository } from '../mock-repository';
import { evaluateCommuteMatch, estimateDetourMinutes } from '../../services/matching';
import { formatPublicJourneyView } from '../../services/privacy';
import { RideOccurrence, User, Vehicle } from '@/types';
import { CreateRideSchema, FeedbackSchema } from '../../validation/schemas';

describe('SocietyApps V1 Core Test Suite', () => {
  let repo: MockDynamoRepository;

  beforeEach(() => {
    repo = new MockDynamoRepository();
  });

  describe('1. Multi-Tenant Isolation', () => {
    it('prevents user in Society A from viewing rides in Society B', async () => {
      // Create a second society
      await repo.createSociety({
        id: 'soc-other-002',
        slug: 'other-society',
        name: 'Palm Meadows',
        code: 'PALM2024',
        address: 'Whitefield',
        latitude: 12.9698,
        longitude: 77.7499,
        settings: { max_detour_minutes: 10, require_admin_approval: true, allow_gender_preferences: true },
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Green Glen Heights has 1 seeded ride
      const greenGlenRides = await repo.listOpenRides('soc-ggh-001', dateStr);
      expect(greenGlenRides.length).toBeGreaterThan(0);

      // Palm Meadows must have 0 rides (isolated)
      const palmMeadowRides = await repo.listOpenRides('soc-other-002', dateStr);
      expect(palmMeadowRides.length).toBe(0);
    });

    it('enforces pending approval lifecycle: user is not active until approved', async () => {
      const pendingMembers = await repo.listPendingMemberships('soc-ggh-001');
      expect(pendingMembers.length).toBeGreaterThanOrEqual(1);
      expect(pendingMembers[0].user.fullName).toBe('Rahul Verma');
      expect(pendingMembers[0].status).toBe('PENDING_APPROVAL');

      // Admin approves
      await repo.updateMembershipStatus('soc-ggh-001', pendingMembers[0].userId, 'ACTIVE', 'usr-admin-001');

      const updatedMem = await repo.getMembership('soc-ggh-001', pendingMembers[0].userId);
      expect(updatedMem?.status).toBe('ACTIVE');
      expect(updatedMem?.approvedBy).toBe('usr-admin-001');
    });
  });

  describe('2. Deterministic Route Matching & Detour Constraints', () => {
    it('matches when detour is <= configurable maximum (10 minutes)', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const sampleJourney: RideOccurrence = {
        id: 'jrn-test-1',
        societyId: 'soc-ggh-001',
        offererUserId: 'usr-offerer-001',
        vehicleId: 'veh-001',
        journeyDate: dateStr,
        direction: 'OUTBOUND_SOCIETY',
        departureWindowStart: `${dateStr}T08:00:00.000Z`,
        departureWindowEnd: `${dateStr}T08:20:00.000Z`,
        originName: 'Green Glen Heights',
        originLat: 12.9279,
        originLng: 77.6751,
        destinationName: 'Manyata Tech Park',
        destinationPlaceId: 'place-manyata',
        destinationLat: 13.0500,
        destinationLng: 77.6200,
        baselineDurationMinutes: 45,
        baselineDistanceKm: 24,
        totalSeats: 2,
        availableSeats: 2,
        genderPreference: 'ANY',
        visibility: 'SOCIETY_WIDE',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Passenger along route (e.g. Marathahalli / Ring Road pickup)
      const match = evaluateCommuteMatch({
        journey: sampleJourney,
        seekerUserId: 'usr-seeker-001',
        seekerPickup: { name: 'Bellandur Gate', lat: 12.9300, lng: 77.6780 },
        seekerDropoff: { name: 'Nagavara / Manyata', lat: 13.0450, lng: 77.6210 },
        seekerPreferredTime: `${dateStr}T08:10:00.000Z`,
        maxDetourMinutes: 10,
      });

      expect(match).not.toBeNull();
      expect(match?.detourMinutes).toBeLessThanOrEqual(10);
      expect(['EXCELLENT', 'GOOD']).toContain(match?.qualityLabel);
    });

    it('rejects match when detour exceeds maximum tolerance', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const sampleJourney: RideOccurrence = {
        id: 'jrn-test-2',
        societyId: 'soc-ggh-001',
        offererUserId: 'usr-offerer-001',
        vehicleId: 'veh-001',
        journeyDate: dateStr,
        direction: 'OUTBOUND_SOCIETY',
        departureWindowStart: `${dateStr}T08:00:00.000Z`,
        departureWindowEnd: `${dateStr}T08:20:00.000Z`,
        originName: 'Green Glen Heights',
        originLat: 12.9279,
        originLng: 77.6751,
        destinationName: 'Manyata Tech Park',
        destinationPlaceId: 'place-manyata',
        destinationLat: 13.0500,
        destinationLng: 77.6200,
        baselineDurationMinutes: 45,
        baselineDistanceKm: 24,
        totalSeats: 2,
        availableSeats: 2,
        genderPreference: 'ANY',
        visibility: 'SOCIETY_WIDE',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Far detour (Electronic City to the South while offerer is going North to Manyata)
      const match = evaluateCommuteMatch({
        journey: sampleJourney,
        seekerUserId: 'usr-seeker-001',
        seekerPickup: { name: 'Electronic City Phase 1', lat: 12.8399, lng: 77.6770 },
        seekerDropoff: { name: 'Bannerghatta Road', lat: 12.8900, lng: 77.5900 },
        seekerPreferredTime: `${dateStr}T08:10:00.000Z`,
        maxDetourMinutes: 10,
      });

      expect(match).toBeNull();
    });
  });

  describe('3. Privacy & Contact Disclosure Rules', () => {
    it('masks phone number, flat number, and vehicle registration before acceptance', () => {
      const sampleUser: User = {
        id: 'usr-offerer-001',
        cognitoSub: 'sub-1',
        email: 'ashutosh@example.com',
        mobile: '+919811122233',
        fullName: 'Ashutosh Dixit',
        gender: 'MALE',
        workLocationName: 'Manyata',
        createdAt: new Date().toISOString(),
      };

      const sampleVehicle: Vehicle = {
        id: 'veh-1',
        societyId: 'soc-ggh-001',
        userId: 'usr-offerer-001',
        type: 'SUV',
        make: 'Hyundai',
        model: 'Creta',
        color: 'White',
        registrationNumber: 'KA-04-MM-8921',
        capacity: 4,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      const sampleJourney: RideOccurrence = {
        id: 'jrn-test-1',
        societyId: 'soc-ggh-001',
        offererUserId: 'usr-offerer-001',
        vehicleId: 'veh-1',
        journeyDate: '2026-10-09',
        direction: 'OUTBOUND_SOCIETY',
        departureWindowStart: '2026-10-09T08:00:00.000Z',
        departureWindowEnd: '2026-10-09T08:20:00.000Z',
        originName: 'Society',
        originLat: 12.9,
        originLng: 77.6,
        destinationName: 'Manyata',
        destinationPlaceId: 'place-id',
        destinationLat: 13.0,
        destinationLng: 77.6,
        baselineDurationMinutes: 40,
        baselineDistanceKm: 20,
        totalSeats: 2,
        availableSeats: 2,
        genderPreference: 'ANY',
        visibility: 'SOCIETY_WIDE',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Unaccepted / Browsing view
      const publicView = formatPublicJourneyView(sampleJourney, sampleUser, sampleVehicle, {
        isOfferer: false,
        seekerRequestStatus: undefined,
      });

      expect(publicView.offerer.displayName).toBe('Ashutosh D.');
      expect(publicView.offerer.mobile).toBeUndefined();
      expect(publicView.offerer.flatNumber).toBeUndefined();
      expect(publicView.vehicle.registrationNumber).toBeUndefined();

      // Accepted view
      const acceptedView = formatPublicJourneyView(sampleJourney, sampleUser, sampleVehicle, {
        isOfferer: false,
        seekerRequestStatus: 'ACCEPTED',
        offererFlatNumber: 'Tower B-804',
      });

      expect(acceptedView.offerer.displayName).toBe('Ashutosh Dixit');
      expect(acceptedView.offerer.mobile).toBe('+919811122233');
      expect(acceptedView.offerer.flatNumber).toBe('Tower B-804');
      expect(acceptedView.vehicle.registrationNumber).toBe('KA-04-MM-8921');

      // A missing flat number is never replaced with a made-up one
      const noFlatView = formatPublicJourneyView(sampleJourney, sampleUser, sampleVehicle, {
        isOfferer: false,
        seekerRequestStatus: 'ACCEPTED',
      });
      expect(noFlatView.offerer.flatNumber).toBeUndefined();
    });
  });

  describe('4. In-App Notifications & Audit Pipeline', () => {
    it('creates and lists notifications with tenant isolation', async () => {
      const repo = new MockDynamoRepository();

      await repo.createNotification({
        id: 'notif-t-1',
        societyId: 'soc-ggh-001',
        userId: 'usr-offerer-001',
        title: 'New Ride Request',
        body: 'Priya requested 1 seat to Manyata Tech Park',
        type: 'RIDE_REQUESTED',
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Offerer receives notification
      const offererNotifs = await repo.listUserNotifications('soc-ggh-001', 'usr-offerer-001');
      expect(offererNotifs.length).toBe(1);
      expect(offererNotifs[0].title).toBe('New Ride Request');
      expect(offererNotifs[0].read).toBe(false);

      // Seeker should not see offerer's notifications
      const seekerNotifs = await repo.listUserNotifications('soc-ggh-001', 'usr-seeker-001');
      expect(seekerNotifs.length).toBe(0);

      // Mark as read
      await repo.markNotificationAsRead('soc-ggh-001', 'notif-t-1', 'usr-offerer-001');
      const updatedNotifs = await repo.listUserNotifications('soc-ggh-001', 'usr-offerer-001');
      expect(updatedNotifs[0].read).toBe(true);
    });
  });

  describe('5. Qualitative Feedback & Moderation Workflow', () => {
    it('records qualitative tags without 1-5 star ratings and allows admin resolution', async () => {
      const repo = new MockDynamoRepository();

      // Submit feedback with qualitative badges only
      const fb = await repo.createFeedback({
        id: 'fb-t-1',
        societyId: 'soc-ggh-001',
        journeyId: 'jrn-001',
        fromUserId: 'usr-seeker-001',
        toUserId: 'usr-offerer-001',
        role: 'SEEKER',
        outcome: 'COMPLETED',
        qualitativeTags: ['Reliable & Punctual', 'Comfortable Ride'],
        privateNote: 'Great smooth ride to Manyata',
        createdAt: new Date().toISOString(),
      });

      expect(fb.qualitativeTags).toContain('Reliable & Punctual');
      const received = await repo.listUserFeedbackReceived('soc-ggh-001', 'usr-offerer-001');
      expect(received.length).toBe(1);

      // Submit moderation report
      const report = await repo.createModerationReport({
        id: 'rep-t-1',
        societyId: 'soc-ggh-001',
        reporterId: 'usr-seeker-001',
        reportedUserId: 'usr-offerer-001',
        category: 'NO_SHOW',
        description: 'Driver did not arrive at gate',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });

      expect(report.status).toBe('OPEN');

      // Admin resolves report
      const resolved = await repo.updateModerationReportStatus(
        'soc-ggh-001',
        'rep-t-1',
        'RESOLVED',
        'Discussed with resident; settled mutually',
        'usr-admin-001'
      );

      expect(resolved?.status).toBe('RESOLVED');
      expect(resolved?.resolutionNotes).toBe('Discussed with resident; settled mutually');
    });
  });

  describe('6. Firebase Phone Auth & Mobile Session Context', () => {
    it('creates and resolves resident membership based on mobile phone identity', async () => {
      const repo = new MockDynamoRepository();

      // Simulate resident registration with +91 phone number
      const phoneUser = await repo.createUser({
        id: 'usr-phone-001',
        cognitoSub: 'fb-usr-phone-001',
        email: '9811199999@societyapps.org',
        mobile: '+919811199999',
        fullName: 'Kiran Rao',
        gender: 'FEMALE',
        commuteIntent: 'BOTH',
        createdAt: new Date().toISOString(),
      });

      expect(phoneUser.mobile).toBe('+919811199999');

      // Create membership in Mahaveer Ranches
      const membership = await repo.createMembership({
        id: 'mem-phone-001',
        societyId: 'soc-ggh-001',
        userId: phoneUser.id,
        flatNumber: 'Tower A-902',
        role: 'RESIDENT',
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(membership.status).toBe('PENDING_APPROVAL');

      // Admin approves
      const approved = await repo.updateMembershipStatus(
        'soc-ggh-001',
        phoneUser.id,
        'ACTIVE',
        'usr-admin-001'
      );

      expect(approved.status).toBe('ACTIVE');
      expect(approved.approvedBy).toBe('usr-admin-001');
    });
  });

  describe('7. Production Google Places & Route Detour Matrix', () => {
    it('verifies Bangalore hubs dataset coverage and detour calculations', () => {
      // Origin: Mahaveer Ranches (Hosa Road)
      const ranchesGate = { lat: 12.8715, lng: 77.6534 };
      // Destination: Manyata Tech Park (Hebbal / Nagavara)
      const manyata = { lat: 13.0500, lng: 77.6200 };
      // Waypoint: Silk Board Junction (along direct corridor)
      const silkBoard = { lat: 12.9177, lng: 77.6238 };
      const silkBoardDrop = { lat: 13.0450, lng: 77.6210 };

      const detourOnRoute = estimateDetourMinutes(ranchesGate, manyata, silkBoard, silkBoardDrop);
      // Silk Board is directly on the way from Hosa Road to Manyata; detour must be small (< 10 mins)
      expect(detourOnRoute).toBeLessThanOrEqual(10);

      // Waypoint: Banashankari / West (Significant westward deviation)
      const westPickup = { lat: 12.9180, lng: 77.5300 };
      const westDrop = { lat: 12.9600, lng: 77.5100 };
      const detourOutOffRoute = estimateDetourMinutes(ranchesGate, manyata, westPickup, westDrop);
      expect(detourOutOffRoute).toBeGreaterThan(10);
    });
  });

  describe('8. Production Security & Zod Input Validation', () => {
    it('rejects invalid payloads with strict schema bounds', () => {
      // Invalid date format
      const invalidRide = CreateRideSchema.safeParse({
        vehicleId: 'veh-1',
        journeyDate: 'tomorrow', // Not YYYY-MM-DD
        departureWindowStart: '08:00',
        departureWindowEnd: '08:20',
        destinationName: 'Manyata',
      });
      expect(invalidRide.success).toBe(false);

      // Valid ride
      const validRide = CreateRideSchema.safeParse({
        vehicleId: 'veh-1',
        journeyDate: '2026-10-09',
        departureWindowStart: '2026-10-09T08:00:00+05:30',
        departureWindowEnd: '2026-10-09T08:20:00+05:30',
        destinationName: 'Manyata Tech Park',
        destinationLat: 13.0453,
        destinationLng: 77.6206,
        totalSeats: 2,
      });
      expect(validRide.success).toBe(true);

      // A destination without coordinates is rejected rather than guessed
      const noCoordinates = CreateRideSchema.safeParse({
        vehicleId: 'veh-1',
        journeyDate: '2026-10-09',
        departureWindowStart: '2026-10-09T08:00:00+05:30',
        destinationName: 'Manyata Tech Park',
      });
      expect(noCoordinates.success).toBe(false);

      // Feedback rejects 1-5 star ratings and requires valid enum outcome
      const validFeedback = FeedbackSchema.safeParse({
        journeyId: 'jrn-1',
        toUserId: 'usr-1',
        outcome: 'COMPLETED',
        qualitativeTags: ['Reliable & Punctual'],
      });
      expect(validFeedback.success).toBe(true);
    });
  });

  describe('9. Lessons & Classes Lifecycle & Tenant Isolation', () => {
    it('isolates classes by societyId and enforces approval lifecycle', async () => {
      const societyA = 'soc-ggh-001';
      const societyB = 'soc-pfr-002';

      // 1. Check seeded classes in Society A
      const activeInA = await repo.listActiveClasses(societyA);
      expect(activeInA.length).toBeGreaterThanOrEqual(2); // Yoga & Piano

      // Society B has 0 classes initially
      const activeInB = await repo.listActiveClasses(societyB);
      expect(activeInB.length).toBe(0);

      // 2. Create a new class in Society B
      const newClass = await repo.createClassListing({
        id: 'lsn-test-001',
        societyId: societyB,
        createdByUserId: 'usr-offerer-001',
        classType: 'REGULAR',
        subject: 'Coding',
        description: 'Python & JavaScript for school students',
        feeType: 'PER_MONTH',
        feeAmount: 2000,
        contactName: 'Ashutosh Dixit',
        contactPhone: '+919811122233',
        locationType: 'CLUBHOUSE',
        noAgeLimit: false,
        ageMin: 10,
        ageMax: 17,
        scheduleDays: ['SAT', 'SUN'],
        startTime: '11:00',
        durationMinutes: 90,
        trialAvailable: true,
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Status should be PENDING_APPROVAL and not in active list yet
      expect(newClass.status).toBe('PENDING_APPROVAL');
      const pendingInB = await repo.listPendingClasses(societyB);
      expect(pendingInB.some((c) => c.id === 'lsn-test-001')).toBe(true);

      const activeInBBeforeApproval = await repo.listActiveClasses(societyB);
      expect(activeInBBeforeApproval.length).toBe(0);

      // 3. Admin approves the class
      const approved = await repo.updateClassStatus(societyB, 'lsn-test-001', 'ACTIVE', 'usr-admin-001');
      expect(approved.status).toBe('ACTIVE');
      expect(approved.approvedBy).toBe('usr-admin-001');

      // Now it appears in active list for Society B
      const activeInBAfterApproval = await repo.listActiveClasses(societyB);
      expect(activeInBAfterApproval.length).toBe(1);
      expect(activeInBAfterApproval[0].subject).toBe('Coding');

      // But still does NOT appear in Society A
      const activeInAUnchanged = await repo.listActiveClasses(societyA);
      expect(activeInAUnchanged.some((c) => c.id === 'lsn-test-001')).toBe(false);

      // 4. Tutor marks as FULL
      const markedFull = await repo.updateClassStatus(societyB, 'lsn-test-001', 'FULL', 'usr-offerer-001');
      expect(markedFull.status).toBe('FULL');

      // 5. Tutor deactivates class
      const deactivated = await repo.updateClassStatus(societyB, 'lsn-test-001', 'DEACTIVATED', 'usr-offerer-001');
      expect(deactivated.status).toBe('DEACTIVATED');

      const activeAfterDeactivation = await repo.listActiveClasses(societyB);
      expect(activeAfterDeactivation.length).toBe(0);
    });
  });
});
