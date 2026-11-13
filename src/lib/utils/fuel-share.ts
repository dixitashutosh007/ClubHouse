/**
 * Advisory Fuel Share and Points Calculation Utility
 * 
 * STRICT COMPLIANCE RULES:
 * 1. Zero commercial fares. No payments inside the app.
 * 2. Fuel sharing is peer-to-peer and advisory only.
 * 3. 1 Fuel Point = ₹1 equivalent of shared fuel cost.
 * 4. Formula:
 *    - Trip fuel (L) = distanceKm / mileage (km/L)
 *    - Trip fuel cost (₹) = trip fuel × fuel price (₹/L)
 *    - Each person's share = trip fuel cost / people sharing it
 *      where people sharing = the driver + riders already booked + the new rider.
 *      (Dividing by every offered seat under-pays the driver when seats stay empty.)
 */

export const BANGALORE_FUEL_PRICE_PER_LITRE = 103; // Current average petrol price in INR

export interface FuelPointsCalculation {
  tripDistanceKm: number;
  vehicleMileageKmPerLitre: number;
  fuelPricePerLitre: number;
  totalFuelLitreUsed: number;
  totalTripFuelCostINR: number;
  occupantCount: number; // Driver + Passengers
  perPassengerPoints: number; // 1 Point = ₹1
  settlementNote: string;
}

export function calculateFuelSharePoints(params: {
  distanceKm: number;
  mileageKmPerLitre?: number;
  /** People splitting the cost, driver included (at least 2) */
  sharers?: number;
  fuelPricePerLitre?: number;
}): FuelPointsCalculation {
  const distanceKm = Math.max(1, params.distanceKm || 15);
  // Default mileage based on typical Indian cars (15 km/L) if not configured
  const mileageKmPerLitre = Math.max(5, Math.min(60, params.mileageKmPerLitre || 15));
  const fuelPrice = params.fuelPricePerLitre || BANGALORE_FUEL_PRICE_PER_LITRE;
  const totalOccupants = Math.max(2, Math.round(params.sharers ?? 2));

  const totalFuelLitreUsed = Number((distanceKm / mileageKmPerLitre).toFixed(2));
  const totalTripFuelCostINR = Math.round(totalFuelLitreUsed * fuelPrice);
  
  // Each person's fair share, never shown below ₹10 for very short trips
  const perPassengerPoints = Math.max(10, Math.round(totalTripFuelCostINR / totalOccupants));

  return {
    tripDistanceKm: distanceKm,
    vehicleMileageKmPerLitre: mileageKmPerLitre,
    fuelPricePerLitre: fuelPrice,
    totalFuelLitreUsed,
    totalTripFuelCostINR,
    occupantCount: totalOccupants,
    perPassengerPoints,
    settlementNote: 'An estimate of each person’s share of the fuel. Settled between neighbours; Club House handles no payments.',
  };
}
