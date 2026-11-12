import {
  BookingResult,
  RideCancellationResult,
  planAccept,
  planCancelRide,
  planClose,
} from '@/lib/services/seat-booking';
import { addDays, istDateString, istDateTime } from '@/lib/utils/time';
import { ISocietyRepository } from './repository.interface';
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

/**
 * In-Memory Mock Repository for Localhost Development and Testing.
 * Mirrors the exact tenant isolation and indexing rules of DynamoDB Single-Table Design.
 * Seeds a default Bangalore society (~1,100 families) with realistic demo residents, vehicles, and journeys.
 */
export class MockDynamoRepository implements ISocietyRepository {
  private societies = new Map<string, Society>();
  private users = new Map<string, User>();
  private memberships = new Map<string, SocietyMembership>(); // key: `${societyId}#${userId}`
  private vehicles = new Map<string, Vehicle>(); // key: `${societyId}#${vehicleId}`
  private schedules = new Map<string, RideSchedule>(); // key: `${societyId}#${scheduleId}`
  private occurrences = new Map<string, RideOccurrence>(); // key: `${societyId}#${journeyId}`
  private requests = new Map<string, RideRequest>(); // key: `${societyId}#${requestId}`
  private matches = new Map<string, CommuteMatch>(); // key: `${societyId}#${matchId}`
  private feedbacks: Feedback[] = [];
  private reports: ModerationReport[] = [];
  private suggestions = new Map<string, SocietySuggestion>(); // key: `${societyId}#${suggestionId}`
  private auditEvents: AuditEvent[] = [];
  private notifications = new Map<string, InAppNotification>(); // key: `${societyId}#${notificationId}`
  private lessons = new Map<string, ClassListing>(); // key: `${societyId}#${lessonId}`

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const societyId = 'soc-ggh-001';
    const society: Society = {
      id: societyId,
      slug: 'mahaveer-ranches',
      name: 'Mahaveer Ranches',
      code: 'MR2024',
      address: 'Hosa Road, Off Hosur Road, Electronic City Post, Bangalore, Karnataka 560100',
      latitude: 12.8715,
      longitude: 77.6534,
      settings: {
        max_detour_minutes: 10,
        require_admin_approval: true,
        allow_gender_preferences: true,
        community_rules: '1. Be punctual and arrive at the clubhouse gate 5 minutes early.\n2. Respect co-residents and maintain a quiet, clean carpool atmosphere.\n3. Cancel at least 1 hour in advance if your commute plan changes.\n4. No commercial fares or unauthorized non-residents.',
        lessonCategories: ['Yoga', 'Music', 'Art & Craft', 'Piano', 'Maths', 'Language', 'Fitness', 'Coding', 'Hobby', 'Analytics'],
        emergencyNumber: '+91 80 4000 1234',
        pickupPoints: ['Main Gate', 'Clubhouse Porch', 'Tower A Lobby', 'Tower B3 Lobby'],
        classLocations: ['Clubhouse Hall', 'Amphitheatre', 'Yoga Deck'],
      },
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.societies.set(societyId, society);

    // Second demo society: Prestige Ferns Residency (Harlur / Sarjapur Road)
    const society2Id = 'soc-pfr-002';
    const society2: Society = {
      id: society2Id,
      slug: 'prestige-ferns-residency',
      name: 'Prestige Ferns Residency',
      code: 'PFR2024',
      address: 'Harlur Main Road, Off Sarjapur Road, Bellandur, Bangalore 560102',
      latitude: 12.9056,
      longitude: 77.6698,
      settings: {
        max_detour_minutes: 12,
        require_admin_approval: true,
        allow_gender_preferences: true,
        community_rules: '1. Verified residents only.\n2. Be at the Tower gate on time.',
      },
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.societies.set(society2Id, society2);

    // Platform Super Admin: Rajesh N.
    const platformAdminUser: User = {
      id: 'usr-app-admin-001',
      cognitoSub: 'cognito-sub-appadmin-001',
      email: 'rajesh@societyapps.org',
      mobile: '+919800011122',
      fullName: 'Rajesh Nair',
      gender: 'MALE',
      defaultPersona: 'APP_ADMIN',
      createdAt: new Date().toISOString(),
    };
    this.users.set(platformAdminUser.id, platformAdminUser);
    this.memberships.set(`${societyId}#${platformAdminUser.id}`, {
      id: 'mem-superadmin-001',
      societyId,
      userId: platformAdminUser.id,
      flatNumber: 'HQ-Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Admin User: Vikram Mehta
    const adminUser: User = {
      id: 'usr-admin-001',
      cognitoSub: 'cognito-sub-admin-001',
      email: 'admin@mahaveerranches.org',
      mobile: '+919876543210',
      fullName: 'Vikram Mehta',
      gender: 'MALE',
      workLocationName: 'Electronic City Phase 1',
      workLatitude: 12.8452,
      workLongitude: 77.6602,
      createdAt: new Date().toISOString(),
    };
    this.users.set(adminUser.id, adminUser);
    this.memberships.set(`${societyId}#${adminUser.id}`, {
      id: 'mem-admin-001',
      societyId,
      userId: adminUser.id,
      flatNumber: 'Tower A-1402',
      role: 'SOCIETY_ADMIN',
      status: 'ACTIVE',
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Resident 1: Ashutosh Dixit (Ride Offerer)
    const offererUser: User = {
      id: 'usr-offerer-001',
      cognitoSub: 'cognito-sub-offerer-001',
      email: 'ashutosh@example.com',
      mobile: '+919811122233',
      fullName: 'Ashutosh Dixit',
      gender: 'MALE',
      commuteIntent: 'OFFERER',
      workLocationName: 'Manyata Tech Park, Hebbal',
      workLatitude: 13.05,
      workLongitude: 77.62,
      createdAt: new Date().toISOString(),
    };
    this.users.set(offererUser.id, offererUser);
    this.memberships.set(`${societyId}#${offererUser.id}`, {
      id: 'mem-offerer-001',
      societyId,
      userId: offererUser.id,
      flatNumber: 'Tower B-804',
      role: 'RESIDENT',
      status: 'ACTIVE',
      approvedBy: adminUser.id,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Vehicle 1 for Ashutosh
    const vehicle1: Vehicle = {
      id: 'veh-001',
      societyId,
      userId: offererUser.id,
      type: 'SUV',
      make: 'Hyundai',
      model: 'Creta',
      color: 'Polar White',
      registrationNumber: 'KA-04-MM-8921',
      capacity: 4,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.vehicles.set(`${societyId}#${vehicle1.id}`, vehicle1);

    // Resident 2: Priya Sharma (Ride Seeker / Active)
    const seekerUser: User = {
      id: 'usr-seeker-001',
      cognitoSub: 'cognito-sub-seeker-001',
      email: 'priya.sharma@example.com',
      mobile: '+919822233344',
      fullName: 'Priya Sharma',
      gender: 'FEMALE',
      commuteIntent: 'SEEKER',
      workLocationName: 'Manyata Tech Park, Hebbal',
      workLatitude: 13.05,
      workLongitude: 77.62,
      createdAt: new Date().toISOString(),
    };
    this.users.set(seekerUser.id, seekerUser);
    this.memberships.set(`${societyId}#${seekerUser.id}`, {
      id: 'mem-seeker-001',
      societyId,
      userId: seekerUser.id,
      flatNumber: 'Tower C-302',
      role: 'RESIDENT',
      status: 'ACTIVE',
      approvedBy: adminUser.id,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Resident 3: Rohan Gupta (Second Ride Offerer to Bellandur/EcoSpace)
    const offererUser2: User = {
      id: 'usr-offerer-002',
      cognitoSub: 'cognito-sub-offerer-002',
      email: 'rohan.gupta@example.com',
      mobile: '+919844455566',
      fullName: 'Rohan Gupta',
      gender: 'MALE',
      commuteIntent: 'OFFERER',
      workLocationName: 'EcoSpace, Bellandur Outer Ring Road',
      workLatitude: 12.926,
      workLongitude: 77.6762,
      createdAt: new Date().toISOString(),
    };
    this.users.set(offererUser2.id, offererUser2);
    this.memberships.set(`${societyId}#${offererUser2.id}`, {
      id: 'mem-offerer-002',
      societyId,
      userId: offererUser2.id,
      flatNumber: 'Tower E-501',
      role: 'RESIDENT',
      status: 'ACTIVE',
      approvedBy: adminUser.id,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const vehicle2: Vehicle = {
      id: 'veh-002',
      societyId,
      userId: offererUser2.id,
      type: 'SEDAN',
      make: 'Honda',
      model: 'City',
      color: 'Lunar Silver',
      registrationNumber: 'KA-51-AB-4321',
      capacity: 4,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.vehicles.set(`${societyId}#${vehicle2.id}`, vehicle2);

    // Resident 4: Ananya Sen (Offerer to Whitefield / ITPL)
    const offererUser3: User = {
      id: 'usr-offerer-003',
      cognitoSub: 'cognito-sub-offerer-003',
      email: 'ananya.sen@example.com',
      mobile: '+919855566677',
      fullName: 'Ananya Sen',
      gender: 'FEMALE',
      commuteIntent: 'BOTH',
      workLocationName: 'ITPL, Whitefield',
      workLatitude: 12.9867,
      workLongitude: 77.7366,
      createdAt: new Date().toISOString(),
    };
    this.users.set(offererUser3.id, offererUser3);
    this.memberships.set(`${societyId}#${offererUser3.id}`, {
      id: 'mem-offerer-003',
      societyId,
      userId: offererUser3.id,
      flatNumber: 'Tower F-1204',
      role: 'RESIDENT',
      status: 'ACTIVE',
      approvedBy: adminUser.id,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const vehicle3: Vehicle = {
      id: 'veh-003',
      societyId,
      userId: offererUser3.id,
      type: 'HATCHBACK',
      make: 'Tata',
      model: 'Nexon EV',
      color: 'Teal Blue',
      registrationNumber: 'KA-05-EV-9912',
      capacity: 4,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.vehicles.set(`${societyId}#${vehicle3.id}`, vehicle3);

    // Resident 5: Rahul Verma (Pending Verification)
    const pendingUser: User = {
      id: 'usr-pending-001',
      cognitoSub: 'cognito-sub-pending-001',
      email: 'rahul.verma@example.com',
      mobile: '+919833344455',
      fullName: 'Rahul Verma',
      gender: 'MALE',
      workLocationName: 'Ecospace, Bellandur',
      workLatitude: 12.926,
      workLongitude: 77.6762,
      createdAt: new Date().toISOString(),
    };
    this.users.set(pendingUser.id, pendingUser);
    this.memberships.set(`${societyId}#${pendingUser.id}`, {
      id: 'mem-pending-001',
      societyId,
      userId: pendingUser.id,
      flatNumber: 'Tower D-1101',
      role: 'RESIDENT',
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Resident 6: Sneha Patil (Pending Verification)
    const pendingUser2: User = {
      id: 'usr-pending-002',
      cognitoSub: 'cognito-sub-pending-002',
      email: 'sneha.patil@example.com',
      mobile: '+919877788899',
      fullName: 'Sneha Patil',
      gender: 'FEMALE',
      workLocationName: 'Prestige Tech Cloud, Hebbal',
      workLatitude: 13.0358,
      workLongitude: 77.597,
      createdAt: new Date().toISOString(),
    };
    this.users.set(pendingUser2.id, pendingUser2);
    this.memberships.set(`${societyId}#${pendingUser2.id}`, {
      id: 'mem-pending-002',
      societyId,
      userId: pendingUser2.id,
      flatNumber: 'Tower B-202',
      role: 'RESIDENT',
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed Journeys for Today, Tomorrow, and Day After Tomorrow
    const todayStr = istDateString();
    const tomorrowStr = addDays(todayStr, 1);
    const dayAfterStr = addDays(todayStr, 2);

    // Journey 1: Ashutosh -> Manyata Tech Park (Today & Tomorrow)
    const journey1Today: RideOccurrence = {
      id: 'jrn-today-001',
      societyId,
      offererUserId: offererUser.id,
      vehicleId: vehicle1.id,
      journeyDate: todayStr,
      direction: 'OUTBOUND_SOCIETY',
      departureWindowStart: istDateTime(todayStr, '08:00'),
      departureWindowEnd: istDateTime(todayStr, '08:20'),
      originName: 'Mahaveer Ranches Main Clubhouse Gate',
      originLat: 12.8715,
      originLng: 77.6534,
      destinationName: 'Manyata Tech Park, Hebbal',
      destinationPlaceId: 'ChIJ...Manyata',
      destinationLat: 13.0500,
      destinationLng: 77.6200,
      baselineDurationMinutes: 55,
      baselineDistanceKm: 28,
      totalSeats: 2,
      availableSeats: 2,
      genderPreference: 'ANY',
      visibility: 'SOCIETY_WIDE',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.occurrences.set(`${societyId}#${journey1Today.id}`, journey1Today);

    const journey1Tomorrow: RideOccurrence = {
      id: 'jrn-001',
      societyId,
      offererUserId: offererUser.id,
      vehicleId: vehicle1.id,
      journeyDate: tomorrowStr,
      direction: 'OUTBOUND_SOCIETY',
      departureWindowStart: istDateTime(tomorrowStr, '08:00'),
      departureWindowEnd: istDateTime(tomorrowStr, '08:20'),
      originName: 'Mahaveer Ranches Main Clubhouse Gate',
      originLat: 12.8715,
      originLng: 77.6534,
      destinationName: 'Manyata Tech Park, Hebbal',
      destinationPlaceId: 'ChIJ...Manyata',
      destinationLat: 13.0500,
      destinationLng: 77.6200,
      baselineDurationMinutes: 55,
      baselineDistanceKm: 28,
      totalSeats: 2,
      availableSeats: 2,
      genderPreference: 'ANY',
      visibility: 'SOCIETY_WIDE',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.occurrences.set(`${societyId}#${journey1Tomorrow.id}`, journey1Tomorrow);

    // Journey 2: Rohan -> EcoSpace / Bellandur (Today & Tomorrow)
    const journey2Today: RideOccurrence = {
      id: 'jrn-today-002',
      societyId,
      offererUserId: offererUser2.id,
      vehicleId: vehicle2.id,
      journeyDate: todayStr,
      direction: 'OUTBOUND_SOCIETY',
      departureWindowStart: istDateTime(todayStr, '08:30'),
      departureWindowEnd: istDateTime(todayStr, '08:45'),
      originName: 'Mahaveer Ranches Main Clubhouse Gate',
      originLat: 12.8715,
      originLng: 77.6534,
      destinationName: 'EcoSpace / Bellandur Tech Corridor',
      destinationPlaceId: 'ChIJ...EcoSpace',
      destinationLat: 12.9260,
      destinationLng: 77.6762,
      baselineDurationMinutes: 35,
      baselineDistanceKm: 14,
      totalSeats: 3,
      availableSeats: 3,
      genderPreference: 'ANY',
      visibility: 'SOCIETY_WIDE',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.occurrences.set(`${societyId}#${journey2Today.id}`, journey2Today);

    const journey2Tomorrow: RideOccurrence = {
      id: 'jrn-002',
      societyId,
      offererUserId: offererUser2.id,
      vehicleId: vehicle2.id,
      journeyDate: tomorrowStr,
      direction: 'OUTBOUND_SOCIETY',
      departureWindowStart: istDateTime(tomorrowStr, '08:30'),
      departureWindowEnd: istDateTime(tomorrowStr, '08:45'),
      originName: 'Mahaveer Ranches Main Clubhouse Gate',
      originLat: 12.8715,
      originLng: 77.6534,
      destinationName: 'EcoSpace / Bellandur Tech Corridor',
      destinationPlaceId: 'ChIJ...EcoSpace',
      destinationLat: 12.9260,
      destinationLng: 77.6762,
      baselineDurationMinutes: 35,
      baselineDistanceKm: 14,
      totalSeats: 3,
      availableSeats: 3,
      genderPreference: 'ANY',
      visibility: 'SOCIETY_WIDE',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.occurrences.set(`${societyId}#${journey2Tomorrow.id}`, journey2Tomorrow);

    // Journey 3: Ananya -> ITPL Whitefield (Tomorrow & Day After)
    const journey3Tomorrow: RideOccurrence = {
      id: 'jrn-003',
      societyId,
      offererUserId: offererUser3.id,
      vehicleId: vehicle3.id,
      journeyDate: tomorrowStr,
      direction: 'OUTBOUND_SOCIETY',
      departureWindowStart: istDateTime(tomorrowStr, '08:15'),
      departureWindowEnd: istDateTime(tomorrowStr, '08:35'),
      originName: 'Mahaveer Ranches Main Clubhouse Gate',
      originLat: 12.8715,
      originLng: 77.6534,
      destinationName: 'ITPL / Prestige Shantiniketan, Whitefield',
      destinationPlaceId: 'ChIJ...ITPL',
      destinationLat: 12.9856,
      destinationLng: 77.7314,
      baselineDurationMinutes: 45,
      baselineDistanceKm: 22,
      totalSeats: 2,
      availableSeats: 2,
      genderPreference: 'ANY',
      visibility: 'SOCIETY_WIDE',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.occurrences.set(`${societyId}#${journey3Tomorrow.id}`, journey3Tomorrow);

    const journey3DayAfter: RideOccurrence = {
      id: 'jrn-004',
      societyId,
      offererUserId: offererUser3.id,
      vehicleId: vehicle3.id,
      journeyDate: dayAfterStr,
      direction: 'OUTBOUND_SOCIETY',
      departureWindowStart: istDateTime(dayAfterStr, '08:15'),
      departureWindowEnd: istDateTime(dayAfterStr, '08:35'),
      originName: 'Mahaveer Ranches Main Clubhouse Gate',
      originLat: 12.8715,
      originLng: 77.6534,
      destinationName: 'ITPL / Prestige Shantiniketan, Whitefield',
      destinationPlaceId: 'ChIJ...ITPL',
      destinationLat: 12.9856,
      destinationLng: 77.7314,
      baselineDurationMinutes: 45,
      baselineDistanceKm: 22,
      totalSeats: 2,
      availableSeats: 2,
      genderPreference: 'ANY',
      visibility: 'SOCIETY_WIDE',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.occurrences.set(`${societyId}#${journey3DayAfter.id}`, journey3DayAfter);

    // Initial Audit Events for Mahaveer Ranches
    this.auditEvents.push(
      {
        id: 'audit-001',
        societyId,
        actorUserId: adminUser.id,
        action: 'RESIDENT_APPROVED',
        entityType: 'MEMBERSHIP',
        entityId: 'mem-offerer-001',
        metadata: { residentName: 'Ashutosh Dixit', flat: 'Tower B-804' },
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'audit-002',
        societyId,
        actorUserId: adminUser.id,
        action: 'SOCIETY_SETTINGS_UPDATED',
        entityType: 'SOCIETY',
        entityId: societyId,
        metadata: { maxDetourMinutes: 10, requireAdminApproval: true },
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'audit-003',
        societyId,
        actorUserId: platformAdminUser.id,
        action: 'RBAC_ROLE_ASSIGNED',
        entityType: 'MEMBERSHIP',
        entityId: 'mem-admin-001',
        metadata: { targetUserId: adminUser.id, role: 'SOCIETY_ADMIN' },
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      }
    );

    // Initial Seed Lessons / Classes for Mahaveer Ranches
    const lesson1: ClassListing = {
      id: 'lsn-001',
      societyId,
      createdByUserId: seekerUser.id,
      classType: 'REGULAR',
      subject: 'Yoga',
      isCustomSubject: false,
      description: 'Morning Hatha Yoga & Pranayama for core strength and flexibility. Suitable for all fitness levels. Bring your own mat!',
      feeType: 'PER_MONTH',
      feeAmount: 1500,
      contactName: 'Priya Sharma',
      contactPhone: '+919822233344',
      locationType: 'CLUBHOUSE',
      locationDetail: 'Clubhouse 1st Floor Aerobics Hall',
      noAgeLimit: false,
      ageMin: 16,
      ageMax: 65,
      scheduleDays: ['MON', 'WED', 'FRI'],
      startTime: '06:30',
      durationMinutes: 60,
      trialAvailable: true,
      status: 'ACTIVE',
      approvedBy: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      creatorName: 'Priya Sharma',
      creatorFlat: 'Tower C-302',
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    };
    this.lessons.set(`${societyId}#${lesson1.id}`, lesson1);

    const lesson2: ClassListing = {
      id: 'lsn-002',
      societyId,
      createdByUserId: adminUser.id,
      classType: 'REGULAR',
      subject: 'Piano',
      isCustomSubject: false,
      description: 'Classical & western contemporary piano lessons for kids and teens. Music theory, chord progression, and practical keyboard practice.',
      feeType: 'PER_SESSION',
      feeAmount: 600,
      contactName: 'Vikram Mehta',
      contactPhone: '+919876543210',
      locationType: 'FLAT',
      locationDetail: 'Tower A - 1402',
      noAgeLimit: false,
      ageMin: 6,
      ageMax: 18,
      scheduleDays: ['SAT', 'SUN'],
      startTime: '10:00',
      durationMinutes: 60,
      trialAvailable: true,
      status: 'ACTIVE',
      approvedBy: platformAdminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      creatorName: 'Vikram Mehta',
      creatorFlat: 'Tower A-1402',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    };
    this.lessons.set(`${societyId}#${lesson2.id}`, lesson2);

    const lesson3: ClassListing = {
      id: 'lsn-003',
      societyId,
      createdByUserId: offererUser3.id,
      classType: 'FESTIVE',
      subject: 'Art & Craft',
      isCustomSubject: false,
      description: 'Festive Clay Modelling, Diya Painting, and Rangoli workshop ahead of Diwali. All eco-friendly materials provided.',
      feeType: 'FREE',
      contactName: 'Ananya Sen',
      contactPhone: '+919855566677',
      locationType: 'CLUBHOUSE',
      locationDetail: 'Clubhouse Children Activity Room',
      noAgeLimit: true,
      scheduleDays: ['SUN'],
      startTime: '16:00',
      durationMinutes: 120,
      trialAvailable: false,
      status: 'PENDING_APPROVAL',
      creatorName: 'Ananya Sen',
      creatorFlat: 'Tower F-1204',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    };
    this.lessons.set(`${societyId}#${lesson3.id}`, lesson3);
  }

  // Societies
  async getSocietyById(societyId: string): Promise<Society | null> {
    return this.societies.get(societyId) || null;
  }

  async getSocietyByCode(code: string): Promise<Society | null> {
    for (const s of this.societies.values()) {
      if (s.code.toUpperCase() === code.toUpperCase()) return s;
    }
    return null;
  }

  async listSocieties(): Promise<Society[]> {
    return Array.from(this.societies.values());
  }

  async createSociety(society: Society): Promise<Society> {
    this.societies.set(society.id, society);
    return society;
  }

  async updateSociety(societyId: string, updates: Partial<Society>): Promise<Society> {
    const s = this.societies.get(societyId);
    if (!s) throw new Error(`Society not found: ${societyId}`);
    const updated = { ...s, ...updates };
    this.societies.set(societyId, updated);
    return updated;
  }

  async updateSocietySettings(
    societyId: string,
    settings: Partial<Society['settings']>
  ): Promise<Society> {
    const s = this.societies.get(societyId);
    if (!s) throw new Error(`Society not found: ${societyId}`);
    s.settings = { ...s.settings, ...settings };
    this.societies.set(societyId, s);
    return s;
  }

  // Users & Memberships
  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async getUserByPhone(mobile: string): Promise<User | null> {
    const cleanTarget = mobile.replace(/\D/g, '');
    for (const u of this.users.values()) {
      const cleanU = (u.mobile || '').replace(/\D/g, '');
      if (cleanU === cleanTarget || (cleanU.length >= 10 && cleanTarget.endsWith(cleanU.slice(-10)))) {
        return u;
      }
    }
    return null;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.firebaseUid === firebaseUid) return u;
    }
    return null;
  }

  async createUser(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const u = this.users.get(userId);
    if (!u) throw new Error('User not found');
    const updated = { ...u, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  async getMembership(societyId: string, userId: string): Promise<SocietyMembership | null> {
    return this.memberships.get(`${societyId}#${userId}`) || null;
  }

  async listUserMemberships(userId: string): Promise<SocietyMembership[]> {
    return [...this.memberships.values()].filter((m) => m.userId === userId);
  }

  async createMembership(membership: SocietyMembership): Promise<SocietyMembership> {
    this.memberships.set(`${membership.societyId}#${membership.userId}`, membership);
    return membership;
  }

  async updateMembership(
    societyId: string,
    userId: string,
    updates: Partial<SocietyMembership>
  ): Promise<SocietyMembership> {
    const key = `${societyId}#${userId}`;
    const m = this.memberships.get(key);
    if (!m) throw new Error('Membership not found');
    const updated = { ...m, ...updates, updatedAt: new Date().toISOString() };
    this.memberships.set(key, updated);
    return updated;
  }

  async updateMembershipStatus(
    societyId: string,
    userId: string,
    status: SocietyMembership['status'],
    adminUserId: string,
    reason?: string
  ): Promise<SocietyMembership> {
    const mem = this.memberships.get(`${societyId}#${userId}`);
    if (!mem) throw new Error(`Membership not found for user ${userId} in ${societyId}`);
    mem.status = status;
    mem.updatedAt = new Date().toISOString();
    if (status === 'ACTIVE') {
      mem.approvedBy = adminUserId;
      mem.approvedAt = new Date().toISOString();
    } else if (status === 'REJECTED') {
      mem.rejectionReason = reason;
    }
    this.memberships.set(`${societyId}#${userId}`, mem);
    return mem;
  }

  async listPendingMemberships(societyId: string): Promise<(SocietyMembership & { user: User })[]> {
    const result: (SocietyMembership & { user: User })[] = [];
    for (const [key, mem] of this.memberships.entries()) {
      if (key.startsWith(`${societyId}#`) && mem.status === 'PENDING_APPROVAL') {
        const u = this.users.get(mem.userId);
        if (u) result.push({ ...mem, user: u });
      }
    }
    return result;
  }

  async listSocietyMembers(societyId: string): Promise<(SocietyMembership & { user: User })[]> {
    const result: (SocietyMembership & { user: User })[] = [];
    for (const [key, mem] of this.memberships.entries()) {
      if (key.startsWith(`${societyId}#`)) {
        const u = this.users.get(mem.userId);
        if (u) result.push({ ...mem, user: u });
      }
    }
    return result;
  }

  // Vehicles
  async createVehicle(vehicle: Vehicle): Promise<Vehicle> {
    this.vehicles.set(`${vehicle.societyId}#${vehicle.id}`, vehicle);
    return vehicle;
  }

  async getVehicleById(societyId: string, vehicleId: string): Promise<Vehicle | null> {
    return this.vehicles.get(`${societyId}#${vehicleId}`) || null;
  }

  async listUserVehicles(societyId: string, userId: string): Promise<Vehicle[]> {
    const result: Vehicle[] = [];
    for (const [key, v] of this.vehicles.entries()) {
      if (key.startsWith(`${societyId}#`) && v.userId === userId && v.isActive) {
        result.push(v);
      }
    }
    return result;
  }

  // Ride Schedules
  async createRideSchedule(schedule: RideSchedule): Promise<RideSchedule> {
    this.schedules.set(`${schedule.societyId}#${schedule.id}`, schedule);
    return schedule;
  }

  async listUserSchedules(societyId: string, userId: string): Promise<RideSchedule[]> {
    const result: RideSchedule[] = [];
    for (const [key, s] of this.schedules.entries()) {
      if (key.startsWith(`${societyId}#`) && s.userId === userId && s.isActive) {
        result.push(s);
      }
    }
    return result;
  }

  async deactivateSchedule(societyId: string, scheduleId: string, userId: string): Promise<void> {
    const s = this.schedules.get(`${societyId}#${scheduleId}`);
    if (s && s.userId === userId) {
      s.isActive = false;
      this.schedules.set(`${societyId}#${scheduleId}`, s);
    }
  }

  // Ride Occurrences
  async createRideOccurrence(occurrence: RideOccurrence): Promise<RideOccurrence> {
    this.occurrences.set(`${occurrence.societyId}#${occurrence.id}`, occurrence);
    return occurrence;
  }

  async getRideOccurrence(societyId: string, journeyId: string): Promise<RideOccurrence | null> {
    return this.occurrences.get(`${societyId}#${journeyId}`) || null;
  }

  async listOpenRides(
    societyId: string,
    date?: string,
    direction?: RideOccurrence['direction']
  ): Promise<RideOccurrence[]> {
    const todayStr = istDateString();
    const result: RideOccurrence[] = [];
    for (const [key, occ] of this.occurrences.entries()) {
      if (
        key.startsWith(`${societyId}#`) &&
        (occ.status === 'OPEN' || occ.status === 'PARTIALLY_BOOKED') &&
        occ.availableSeats > 0
      ) {
        // If specific date requested, match it; otherwise show all today and upcoming rides
        const dateMatches = date && date !== 'ALL' ? occ.journeyDate === date : occ.journeyDate >= todayStr;
        if (dateMatches) {
          if (!direction || occ.direction === direction) {
            result.push(occ);
          }
        }
      }
    }
    return result.sort((a, b) => a.journeyDate.localeCompare(b.journeyDate));
  }

  async listUserRides(societyId: string, userId: string): Promise<RideOccurrence[]> {
    const result: RideOccurrence[] = [];
    for (const [key, occ] of this.occurrences.entries()) {
      if (key.startsWith(`${societyId}#`) && occ.offererUserId === userId) {
        result.push(occ);
      }
    }
    return result.sort((a, b) => b.journeyDate.localeCompare(a.journeyDate));
  }

  async updateRideOccurrence(
    societyId: string,
    journeyId: string,
    userId: string,
    updates: Partial<RideOccurrence>
  ): Promise<RideOccurrence> {
    const occ = this.occurrences.get(`${societyId}#${journeyId}`);
    if (!occ) throw new Error('Journey not found');
    if (occ.offererUserId !== userId) throw new Error('Unauthorized to edit this journey');

    const updated: RideOccurrence = {
      ...occ,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.occurrences.set(`${societyId}#${journeyId}`, updated);
    return updated;
  }

  async cancelRideWithRequests(
    societyId: string,
    journeyId: string,
    offererUserId: string,
    reason: string
  ): Promise<RideCancellationResult> {
    // No awaits between read and write: atomic on the single JS thread
    const journey = this.occurrences.get(`${societyId}#${journeyId}`) ?? null;
    const requests = [...this.requests.values()].filter(
      (r) => r.societyId === societyId && r.journeyId === journeyId
    );
    const result = planCancelRide(journey, requests, offererUserId, reason, new Date().toISOString());
    if (result.ok) {
      this.occurrences.set(`${societyId}#${journeyId}`, result.journey);
      for (const r of result.affectedRequests) this.requests.set(`${societyId}#${r.id}`, r);
    }
    return result;
  }

  // Ride Requests
  async createRideRequest(request: RideRequest): Promise<RideRequest> {
    this.requests.set(`${request.societyId}#${request.id}`, request);
    return request;
  }

  async getRideRequest(societyId: string, requestId: string): Promise<RideRequest | null> {
    return this.requests.get(`${societyId}#${requestId}`) || null;
  }

  async listJourneyRequests(societyId: string, journeyId: string): Promise<RideRequest[]> {
    const result: RideRequest[] = [];
    for (const [key, req] of this.requests.entries()) {
      if (key.startsWith(`${societyId}#`) && req.journeyId === journeyId) {
        result.push(req);
      }
    }
    return result;
  }

  async listUserRequests(societyId: string, userId: string): Promise<RideRequest[]> {
    const result: RideRequest[] = [];
    for (const [key, req] of this.requests.entries()) {
      if (key.startsWith(`${societyId}#`) && req.seekerUserId === userId) {
        result.push(req);
      }
    }
    return result;
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

  // No awaits between read and write: atomic on the single JS thread
  private applyBooking(
    societyId: string,
    requestId: string,
    plan: (journey: RideOccurrence | null, request: RideRequest | null, now: string) => BookingResult
  ): BookingResult {
    const request = this.requests.get(`${societyId}#${requestId}`) ?? null;
    const journey = request ? this.occurrences.get(`${societyId}#${request.journeyId}`) ?? null : null;
    const result = plan(journey, request, new Date().toISOString());
    if (result.ok) {
      this.occurrences.set(`${societyId}#${result.journey.id}`, result.journey);
      this.requests.set(`${societyId}#${result.request.id}`, result.request);
    }
    return result;
  }

  // Matches
  async saveMatch(match: CommuteMatch): Promise<CommuteMatch> {
    this.matches.set(`${match.societyId}#${match.id}`, match);
    return match;
  }

  async listUserMatches(societyId: string, userId: string): Promise<CommuteMatch[]> {
    const result: CommuteMatch[] = [];
    for (const [key, m] of this.matches.entries()) {
      if (key.startsWith(`${societyId}#`) && m.seekerUserId === userId) {
        result.push(m);
      }
    }
    return result.sort((a, b) => b.qualityScore - a.qualityScore);
  }

  // Feedback & Moderation
  async createFeedback(feedback: Feedback): Promise<Feedback> {
    this.feedbacks.push(feedback);
    return feedback;
  }

  async listUserFeedbackReceived(societyId: string, userId: string): Promise<Feedback[]> {
    return this.feedbacks.filter((f) => f.societyId === societyId && f.toUserId === userId);
  }

  async createModerationReport(report: ModerationReport): Promise<ModerationReport> {
    this.reports.push(report);
    return report;
  }

  async listModerationReports(societyId: string): Promise<ModerationReport[]> {
    return this.reports.filter((r) => r.societyId === societyId);
  }

  async updateModerationReportStatus(
    societyId: string,
    reportId: string,
    status: ModerationReport['status'],
    resolutionNotes?: string,
    adminUserId?: string
  ): Promise<ModerationReport | null> {
    const report = this.reports.find((r) => r.societyId === societyId && r.id === reportId);
    if (!report) return null;
    report.status = status;
    if (resolutionNotes) report.resolutionNotes = resolutionNotes;
    if (adminUserId) report.resolvedBy = adminUserId;
    return report;
  }

  async createSuggestion(suggestion: SocietySuggestion): Promise<SocietySuggestion> {
    this.suggestions.set(`${suggestion.societyId}#${suggestion.id}`, suggestion);
    return suggestion;
  }

  async listSuggestions(societyId: string): Promise<SocietySuggestion[]> {
    return [...this.suggestions.values()]
      .filter((s) => s.societyId === societyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateSuggestion(
    societyId: string,
    suggestionId: string,
    updates: Partial<Pick<SocietySuggestion, 'status' | 'resolvedBy' | 'resolvedAt'>>
  ): Promise<SocietySuggestion | null> {
    const key = `${societyId}#${suggestionId}`;
    const existing = this.suggestions.get(key);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.suggestions.set(key, updated);
    return updated;
  }

  // Auditing
  async recordAuditEvent(event: AuditEvent): Promise<void> {
    this.auditEvents.push(event);
  }

  async listAuditEvents(societyId: string): Promise<AuditEvent[]> {
    return this.auditEvents
      .filter((e) => e.societyId === societyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);
  }

  // In-App & Push Notifications
  async createNotification(notification: InAppNotification): Promise<InAppNotification> {
    const key = `${notification.societyId}#${notification.id}`;
    this.notifications.set(key, notification);
    return notification;
  }

  async listUserNotifications(societyId: string, userId: string): Promise<InAppNotification[]> {
    const result: InAppNotification[] = [];
    for (const [key, n] of this.notifications.entries()) {
      if (key.startsWith(`${societyId}#`) && n.userId === userId) {
        result.push(n);
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markNotificationAsRead(societyId: string, notificationId: string, userId: string): Promise<boolean> {
    const key = `${societyId}#${notificationId}`;
    const notif = this.notifications.get(key);
    if (!notif || notif.userId !== userId) return false;
    notif.read = true;
    this.notifications.set(key, notif);
    return true;
  }

  async markAllNotificationsAsRead(societyId: string, userId: string): Promise<void> {
    for (const [key, notif] of this.notifications.entries()) {
      if (key.startsWith(`${societyId}#`) && notif.userId === userId) {
        notif.read = true;
        this.notifications.set(key, notif);
      }
    }
  }

  // Lessons / Classes
  async createClassListing(listing: ClassListing): Promise<ClassListing> {
    const key = `${listing.societyId}#${listing.id}`;
    this.lessons.set(key, listing);
    return listing;
  }

  async getClassListing(societyId: string, listingId: string): Promise<ClassListing | null> {
    const key = `${societyId}#${listingId}`;
    return this.lessons.get(key) || null;
  }

  async listActiveClasses(
    societyId: string,
    subject?: string,
    classType?: ClassType
  ): Promise<ClassListing[]> {
    const results: ClassListing[] = [];
    for (const [key, item] of this.lessons.entries()) {
      if (key.startsWith(`${societyId}#`) && (item.status === 'ACTIVE' || item.status === 'FULL')) {
        if (subject && subject !== 'ALL' && item.subject.toLowerCase() !== subject.toLowerCase()) {
          continue;
        }
        if (classType && item.classType !== classType) {
          continue;
        }
        results.push(item);
      }
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listPendingClasses(societyId: string): Promise<ClassListing[]> {
    const results: ClassListing[] = [];
    for (const [key, item] of this.lessons.entries()) {
      if (key.startsWith(`${societyId}#`) && item.status === 'PENDING_APPROVAL') {
        results.push(item);
      }
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listUserClasses(societyId: string, userId: string): Promise<ClassListing[]> {
    const results: ClassListing[] = [];
    for (const [key, item] of this.lessons.entries()) {
      if (key.startsWith(`${societyId}#`) && item.createdByUserId === userId) {
        results.push(item);
      }
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateClassListing(
    societyId: string,
    listingId: string,
    userId: string,
    updates: Partial<ClassListing>
  ): Promise<ClassListing> {
    const key = `${societyId}#${listingId}`;
    const existing = this.lessons.get(key);
    if (!existing) {
      throw new Error(`Class listing not found: ${listingId}`);
    }
    if (existing.createdByUserId !== userId) {
      throw new Error('Unauthorized to modify this class listing');
    }
    const updated: ClassListing = {
      ...existing,
      ...updates,
      id: existing.id,
      societyId: existing.societyId,
      createdByUserId: existing.createdByUserId,
      updatedAt: new Date().toISOString(),
    };
    this.lessons.set(key, updated);
    return updated;
  }

  async updateClassStatus(
    societyId: string,
    listingId: string,
    status: ClassStatus,
    actorUserId: string,
    reason?: string
  ): Promise<ClassListing> {
    const key = `${societyId}#${listingId}`;
    const existing = this.lessons.get(key);
    if (!existing) {
      throw new Error(`Class listing not found: ${listingId}`);
    }
    const updated: ClassListing = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    if (status === 'ACTIVE') {
      updated.approvedBy = actorUserId;
      updated.approvedAt = new Date().toISOString();
      updated.rejectionReason = undefined;
    } else if (status === 'REJECTED') {
      updated.rejectionReason = reason || 'Declined by society admin';
    }
    this.lessons.set(key, updated);
    return updated;
  }

  async deleteClassListing(societyId: string, listingId: string, userId: string): Promise<void> {
    const key = `${societyId}#${listingId}`;
    const existing = this.lessons.get(key);
    if (!existing) return;
    if (existing.createdByUserId !== userId) {
      throw new Error('Unauthorized to delete this class listing');
    }
    this.lessons.delete(key);
  }
}
