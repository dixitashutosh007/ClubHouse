import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeRequest, resetRepository } from '@/test/route-helpers';
import { resetFirebaseMock } from '@/test/firebase-admin-mock';
import { MockDynamoRepository } from '@/lib/db/mock-repository';
import { POST, PATCH } from '../vehicles/route';
import { GET as ridesGet } from '../../rides/route';
import { PUT as saveSettings } from '../../admin/settings/route';

vi.mock('@/lib/firebase/admin', async () => (await import('@/test/firebase-admin-mock')).firebaseAdminMock);

const SOC = 'soc-ggh-001';
const h = (userId: string) => ({ 'x-dev-user-id': userId, 'x-society-id': SOC });
const ASHUTOSH = 'usr-offerer-001'; // owns veh-001 and offers jrn-001
const PRIYA = 'usr-seeker-001';

describe('vehicle fuel type', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  it('requires sign-in in production', async () => {
    resetFirebaseMock();
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(
        (
          await PATCH(
            makeRequest('/api/v1/user/vehicles', { method: 'PATCH', body: { vehicleId: 'veh-001', fuelType: 'EV', mileageKmPerLitre: 7 } })
          )
        ).status
      ).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('saves the fuel type with a sensible default mileage for that fuel', async () => {
    const add = (body: object) =>
      POST(
        makeRequest('/api/v1/user/vehicles', {
          method: 'POST',
          headers: h(PRIYA),
          body: { make: 'Tata', model: 'Nexon', registrationNumber: 'KA-05-MN-4321', ...body },
        })
      );
    const ev = (await (await add({ fuelType: 'EV' })).json()).vehicle;
    expect(ev).toMatchObject({ fuelType: 'EV', mileageKmPerLitre: 7 });
    const petrol = (await (await add({ registrationNumber: 'KA-05-MN-4322' })).json()).vehicle;
    expect(petrol).toMatchObject({ fuelType: 'PETROL', mileageKmPerLitre: 15 });
    expect((await add({ registrationNumber: 'KA-05-MN-4323', fuelType: 'HYDROGEN' })).status).toBe(400);
  });

  it('lets owners change their own vehicle only', async () => {
    const patch = (userId: string, body: object) =>
      PATCH(makeRequest('/api/v1/user/vehicles', { method: 'PATCH', headers: h(userId), body }));
    expect((await patch(PRIYA, { vehicleId: 'veh-001', fuelType: 'EV', mileageKmPerLitre: 7 })).status).toBe(404);
    expect((await patch(ASHUTOSH, { vehicleId: 'veh-001', fuelType: 'EV', mileageKmPerLitre: 100 })).status).toBe(400);
    expect((await patch(ASHUTOSH, { vehicleId: 'veh-001', fuelType: 'CNG', mileageKmPerLitre: 21.37 })).status).toBe(200);
    expect(await repo.getVehicleById(SOC, 'veh-001')).toMatchObject({ fuelType: 'CNG', mileageKmPerLitre: 21.4 });
  });

  it("prices ride estimates with the car's fuel and the society's price", async () => {
    await saveSettings(makeRequest('/api/v1/admin/settings', { method: 'PUT', headers: h('usr-admin-001'), body: { evPricePerKwh: 10 } }));
    await PATCH(
      makeRequest('/api/v1/user/vehicles', {
        method: 'PATCH',
        headers: h(ASHUTOSH),
        body: { vehicleId: 'veh-001', fuelType: 'EV', mileageKmPerLitre: 7 },
      })
    );
    const rides = (await (await ridesGet(makeRequest('/api/v1/rides', { headers: h(PRIYA) }))).json()).rides as {
      id: string;
      fuelSharePointsEstimate: { fuelType: string; fuelUnit: string; fuelPricePerLitre: number; vehicleMileageKmPerLitre: number };
    }[];
    const ride = rides.find((r) => r.id === 'jrn-001')!;
    expect(ride.fuelSharePointsEstimate).toMatchObject({
      fuelType: 'EV',
      fuelUnit: 'kWh',
      fuelPricePerLitre: 10,
      vehicleMileageKmPerLitre: 7,
    });
    // Residents cannot set prices
    expect(
      (await saveSettings(makeRequest('/api/v1/admin/settings', { method: 'PUT', headers: h(PRIYA), body: { evPricePerKwh: 1 } }))).status
    ).toBe(403);
    expect(
      (
        await saveSettings(
          makeRequest('/api/v1/admin/settings', { method: 'PUT', headers: h('usr-admin-001'), body: { evPricePerKwh: 500 } })
        )
      ).status
    ).toBe(400);
  });
});
