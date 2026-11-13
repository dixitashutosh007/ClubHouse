import { describe, it, expect } from 'vitest';
import { calculateFuelSharePoints } from '../fuel-share';

describe('fuel share estimate', () => {
  it('splits the trip fuel cost between the driver and the people riding', () => {
    // 30 km at 15 km/L = 2 L; 2 L x ₹100 = ₹200
    const two = calculateFuelSharePoints({ distanceKm: 30, mileageKmPerLitre: 15, sharers: 2, fuelPricePerLitre: 100 });
    expect(two.totalTripFuelCostINR).toBe(200);
    expect(two.perPassengerPoints).toBe(100); // driver + you

    const four = calculateFuelSharePoints({ distanceKm: 30, mileageKmPerLitre: 15, sharers: 4, fuelPricePerLitre: 100 });
    expect(four.perPassengerPoints).toBe(50); // driver + 2 booked + you
  });

  it('never counts fewer than two people, and never shows less than ₹10', () => {
    expect(calculateFuelSharePoints({ distanceKm: 30, mileageKmPerLitre: 15, sharers: 1, fuelPricePerLitre: 100 }).perPassengerPoints).toBe(100);
    expect(calculateFuelSharePoints({ distanceKm: 2, mileageKmPerLitre: 20, sharers: 4 }).perPassengerPoints).toBe(10);
  });
});
