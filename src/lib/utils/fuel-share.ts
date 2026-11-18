import type { FuelType, SocietySettings } from '@/types';

/**
 * Advisory Fuel Share and Points Calculation Utility
 *
 * STRICT COMPLIANCE RULES:
 * 1. Zero commercial fares. No payments inside the app.
 * 2. Fuel sharing is peer-to-peer and advisory only.
 * 3. 1 Fuel Point = ₹1 equivalent of shared fuel cost.
 * 4. Formula (in the car's own fuel unit: litres, kg of CNG or kWh):
 *    - Trip fuel = distanceKm / mileage (km per unit)
 *    - Trip fuel cost (₹) = trip fuel × price per unit
 *    - Each person's share = trip fuel cost / people sharing it
 *      where people sharing = the driver + riders already booked + the new rider.
 *      (Dividing by every offered seat under-pays the driver when seats stay empty.)
 */

export interface FuelInfo {
  label: string;
  /** Unit the fuel is bought in */
  unit: 'L' | 'kg' | 'kWh';
  /** Bangalore starting price per unit (₹); society admins can change it */
  defaultPrice: number;
  /** Typical distance per unit for a car */
  defaultMileage: number;
  /** Mileage accepted for this fuel (km per unit) */
  mileageRange: [number, number];
}

export const FUELS: Record<FuelType, FuelInfo> = {
  PETROL: { label: 'Petrol', unit: 'L', defaultPrice: 103, defaultMileage: 15, mileageRange: [5, 80] },
  DIESEL: { label: 'Diesel', unit: 'L', defaultPrice: 90, defaultMileage: 18, mileageRange: [5, 80] },
  CNG: { label: 'CNG', unit: 'kg', defaultPrice: 89, defaultMileage: 22, mileageRange: [8, 80] },
  EV: { label: 'Electric', unit: 'kWh', defaultPrice: 9, defaultMileage: 7, mileageRange: [3, 80] },
};

export const FUEL_TYPES = Object.keys(FUELS) as FuelType[];

/** Kept for older callers: the default petrol price */
export const BANGALORE_FUEL_PRICE_PER_LITRE = FUELS.PETROL.defaultPrice;

/** The society's price for a fuel, or the starting price if its admin has not set one */
export function fuelPriceFor(
  settings: Pick<SocietySettings, 'fuelPricePerLitre' | 'dieselPricePerLitre' | 'cngPricePerKg' | 'evPricePerKwh'> | undefined,
  fuelType: FuelType = 'PETROL'
): number {
  const set = {
    PETROL: settings?.fuelPricePerLitre,
    DIESEL: settings?.dieselPricePerLitre,
    CNG: settings?.cngPricePerKg,
    EV: settings?.evPricePerKwh,
  }[fuelType];
  return set || FUELS[fuelType].defaultPrice;
}

const PRICE_WORDS: Record<FuelType, string> = {
  PETROL: 'a litre of petrol',
  DIESEL: 'a litre of diesel',
  CNG: 'a kg of CNG',
  EV: 'a kWh of electricity',
};

/** "₹103 a litre of petrol", "₹9 a kWh of electricity" */
export function fuelPriceNote(settings: Parameters<typeof fuelPriceFor>[0], fuelType: FuelType = 'PETROL'): string {
  return `₹${fuelPriceFor(settings, fuelType)} ${PRICE_WORDS[fuelType]}`;
}

/** "km/L", "km/kg" or "km/kWh" */
export const mileageUnit = (fuelType: FuelType = 'PETROL') => `km/${FUELS[fuelType].unit}`;

export interface FuelPointsCalculation {
  tripDistanceKm: number;
  fuelType: FuelType;
  /** Distance per unit of fuel (km/L, km/kg or km/kWh) */
  vehicleMileageKmPerLitre: number;
  /** Price per unit of fuel (₹) */
  fuelPricePerLitre: number;
  /** Fuel used, in the fuel's unit */
  totalFuelLitreUsed: number;
  totalTripFuelCostINR: number;
  occupantCount: number; // Driver + Passengers
  perPassengerPoints: number; // 1 Point = ₹1
  settlementNote: string;
}

export function calculateFuelSharePoints(params: {
  distanceKm: number;
  /** Distance per unit of the car's fuel */
  mileageKmPerLitre?: number;
  /** People splitting the cost, driver included (at least 2) */
  sharers?: number;
  /** Price per unit of the car's fuel */
  fuelPricePerLitre?: number;
  fuelType?: FuelType;
}): FuelPointsCalculation {
  const fuelType = params.fuelType ?? 'PETROL';
  const fuel = FUELS[fuelType];
  const distanceKm = Math.max(1, params.distanceKm || 15);
  const [minMileage, maxMileage] = fuel.mileageRange;
  const mileage = Math.max(minMileage, Math.min(maxMileage, params.mileageKmPerLitre || fuel.defaultMileage));
  const price = params.fuelPricePerLitre || fuel.defaultPrice;
  const totalOccupants = Math.max(2, Math.round(params.sharers ?? 2));

  const fuelUsed = Number((distanceKm / mileage).toFixed(2));
  const totalTripFuelCostINR = Math.round(fuelUsed * price);

  // Each person's fair share, never shown below ₹10 for very short trips
  const perPassengerPoints = Math.max(10, Math.round(totalTripFuelCostINR / totalOccupants));

  return {
    tripDistanceKm: distanceKm,
    fuelType,
    vehicleMileageKmPerLitre: mileage,
    fuelPricePerLitre: price,
    totalFuelLitreUsed: fuelUsed,
    totalTripFuelCostINR,
    occupantCount: totalOccupants,
    perPassengerPoints,
    settlementNote: 'An estimate of each person’s share of the fuel. Settled between neighbours; Club House handles no payments.',
  };
}
