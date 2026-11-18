import { describe, it, expect } from 'vitest';
import { calculateFuelSharePoints, fuelPriceFor, fuelPriceNote } from '../fuel-share';

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

describe('fuel types', () => {
  it('prices each fuel in its own unit', () => {
    // Electric: 28 km at 7 km/kWh = 4 kWh x ₹9 = ₹36, split between two
    const ev = calculateFuelSharePoints({ distanceKm: 28, mileageKmPerLitre: 7, sharers: 2, fuelPricePerLitre: 9, fuelType: 'EV' });
    expect(ev.totalTripFuelCostINR).toBe(36);
    expect(ev.perPassengerPoints).toBe(18);
    // CNG: 44 km at 22 km/kg = 2 kg x ₹89 = ₹178
    expect(calculateFuelSharePoints({ distanceKm: 44, mileageKmPerLitre: 22, fuelPricePerLitre: 89, fuelType: 'CNG' }).totalTripFuelCostINR).toBe(178);
  });

  it('uses typical mileage and the starting price for each fuel when none is set', () => {
    expect(calculateFuelSharePoints({ distanceKm: 18, fuelType: 'DIESEL' })).toMatchObject({ vehicleMileageKmPerLitre: 18, fuelPricePerLitre: 90 });
    expect(calculateFuelSharePoints({ distanceKm: 14, fuelType: 'EV' })).toMatchObject({ vehicleMileageKmPerLitre: 7, fuelPricePerLitre: 9 });
    expect(calculateFuelSharePoints({ distanceKm: 15 })).toMatchObject({ fuelType: 'PETROL', fuelPricePerLitre: 103 });
  });

  it("reads the society's price for each fuel", () => {
    const settings = { fuelPricePerLitre: 105, dieselPricePerLitre: 92, cngPricePerKg: 95, evPricePerKwh: 12 };
    expect(fuelPriceFor(settings, 'PETROL')).toBe(105);
    expect(fuelPriceFor(settings, 'DIESEL')).toBe(92);
    expect(fuelPriceFor(settings, 'CNG')).toBe(95);
    expect(fuelPriceFor(settings, 'EV')).toBe(12);
    expect(fuelPriceFor({}, 'EV')).toBe(9);
    expect(fuelPriceFor(undefined)).toBe(103);
    expect(fuelPriceNote(settings, 'EV')).toBe('₹12 a kWh of electricity');
    expect(fuelPriceNote(undefined, 'CNG')).toBe('₹89 a kg of CNG');
  });
});
