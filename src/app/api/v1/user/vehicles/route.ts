import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { ONBOARDING_STATUSES, requireAuth, errorResponse, serverError } from '@/lib/api-auth';
import { Vehicle } from '@/types';
import { validateIndianRegistration, formatIndianRegistration } from '@/lib/utils/indian-vehicle';
import { CreateVehicleSchema, UpdateVehicleSchema } from '@/lib/validation/schemas';
import { FUELS } from '@/lib/utils/fuel-share';
import { parseBody } from '@/lib/validation/parse';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const repo = getRepository();
  const vehicles = await repo.listUserVehicles(auth.societyId, auth.userId);
  return NextResponse.json({ vehicles });
}

export async function POST(req: NextRequest) {
  // Allow ACTIVE residents and onboarding residents awaiting approval
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, CreateVehicleSchema);
  if (body instanceof NextResponse) return body;
  const { type, make, model, color, registrationNumber, capacity, mileageKmPerLitre, fuelType } = body;

  // Indian standard vehicle number validation
  const regCheck = validateIndianRegistration(registrationNumber);
  if (!regCheck.isValid) {
    return errorResponse(regCheck.error || 'Invalid Indian vehicle registration number', 400);
  }

  const formattedReg = formatIndianRegistration(registrationNumber);

  // Mileage is in the fuel's own unit and range-checked by the schema; otherwise a typical figure for that fuel
  const parsedMileage = mileageKmPerLitre !== undefined ? Math.round(mileageKmPerLitre * 10) / 10 : FUELS[fuelType].defaultMileage;

  const repo = getRepository();
  const vehicle: Vehicle = {
    id: `veh-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    userId: auth.userId,
    type,
    make,
    model,
    color: color || 'White',
    registrationNumber: formattedReg,
    capacity: capacity ?? (type === 'TWO_WHEELER' ? 1 : 4),
    fuelType,
    mileageKmPerLitre: parsedMileage,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const saved = await repo.createVehicle(vehicle);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'VEHICLE_REGISTERED',
    entityType: 'VEHICLE',
    entityId: saved.id,
    metadata: { make, model },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, vehicle: saved });
}

// Change the fuel and mileage of one of your own vehicles
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, UpdateVehicleSchema);
  if (body instanceof NextResponse) return body;

  try {
    const repo = getRepository();
    const vehicle = await repo.getVehicleById(auth.societyId, body.vehicleId);
    // Someone else's vehicle looks the same as a missing one
    if (!vehicle || vehicle.userId !== auth.userId || !vehicle.isActive) return errorResponse('Vehicle not found', 404);
    const mileage = Math.round(body.mileageKmPerLitre * 10) / 10;
    await repo.updateVehicle(auth.societyId, vehicle.id, { fuelType: body.fuelType, mileageKmPerLitre: mileage });
    return NextResponse.json({ success: true, vehicle: { ...vehicle, fuelType: body.fuelType, mileageKmPerLitre: mileage } });
  } catch (err) {
    return serverError('vehicles PATCH', err);
  }
}
