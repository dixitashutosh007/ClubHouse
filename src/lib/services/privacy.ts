import {
  RideOccurrence,
  PublicJourneyView,
  PublicOffererProfile,
  PublicVehicleView,
  RequestStatus,
  User,
  Vehicle,
} from '@/types';

/**
 * Creates client-safe anonymized view of a journey.
 * Rules:
 * 1. Offerer full name is truncated to "First Name + Last Initial" (e.g. Ashutosh D.)
 * 2. Mobile number and flat number are STRIPPED unless the request is in ACCEPTED status.
 * 3. Vehicle plate number is STRIPPED unless the request is in ACCEPTED status.
 * 4. Email is NEVER revealed in public ride listings.
 */
import { calculateFuelSharePoints } from '../utils/fuel-share';

export function formatPublicJourneyView(
  occurrence: RideOccurrence,
  offererUser: User,
  vehicle: Vehicle,
  currentUserRoleInJourney?: {
    isOfferer: boolean;
    seekerRequestStatus?: RequestStatus;
    offererFlatNumber?: string;
  }
): PublicJourneyView {
  const isAcceptedParticipant =
    currentUserRoleInJourney?.isOfferer ||
    currentUserRoleInJourney?.seekerRequestStatus === 'ACCEPTED';

  // Format Display Name: "Ashutosh Dixit" -> "Ashutosh D."
  const nameParts = offererUser.fullName.trim().split(' ');
  const displayName =
    nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
      : offererUser.fullName;


  const offererProfile: PublicOffererProfile = {
    id: offererUser.id,
    displayName: isAcceptedParticipant ? offererUser.fullName : displayName,
    verificationBadge: 'Verified Resident',
    workLocation: offererUser.workLocationName,
    flatNumber: isAcceptedParticipant ? currentUserRoleInJourney?.offererFlatNumber : undefined, // unmasked only if accepted
    mobile: isAcceptedParticipant ? offererUser.mobile : undefined, // unmasked only if accepted
  };

  const vehicleView: PublicVehicleView = {
    type: vehicle.type,
    make: vehicle.make,
    model: vehicle.model,
    color: vehicle.color,
    registrationNumber: isAcceptedParticipant ? vehicle.registrationNumber : undefined,
  };

  // Compute fuel points estimate based on vehicle mileage and trip distance
  const distanceKm = occurrence.baselineDistanceKm;
  const fuelCalc = calculateFuelSharePoints({
    distanceKm,
    mileageKmPerLitre: vehicle.mileageKmPerLitre || 15,
    seatsOffered: occurrence.totalSeats,
  });

  return {
    id: occurrence.id,
    journeyDate: occurrence.journeyDate,
    direction: occurrence.direction,
    departureWindowStart: occurrence.departureWindowStart,
    departureWindowEnd: occurrence.departureWindowEnd,
    originName: occurrence.originName,
    meetingPoint: occurrence.meetingPoint,
    destinationName: occurrence.destinationName,
    totalSeats: occurrence.totalSeats,
    availableSeats: occurrence.availableSeats,
    genderPreference: occurrence.genderPreference,
    offerer: offererProfile,
    vehicle: vehicleView,
    status: occurrence.status,
    userRequestStatus: currentUserRoleInJourney?.seekerRequestStatus,
    baselineDistanceKm: distanceKm,
    fuelSharePointsEstimate: {
      totalFuelCost: fuelCalc.totalTripFuelCostINR,
      perPassengerPoints: fuelCalc.perPassengerPoints,
      fuelPricePerLitre: fuelCalc.fuelPricePerLitre,
      vehicleMileageKmPerLitre: fuelCalc.vehicleMileageKmPerLitre,
      disclaimer: fuelCalc.settlementNote,
    },
  };
}
