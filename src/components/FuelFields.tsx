'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { FUELS, FUEL_TYPES, mileageUnit } from '@/lib/utils/fuel-share';
import type { FuelType } from '@/types';

interface FuelFieldsProps {
  fuelType: FuelType;
  mileage: string;
  onChange: (fuelType: FuelType, mileage: string) => void;
  /** Prefix for the field ids (several forms can show these) */
  idPrefix: string;
}

/**
 * What the vehicle runs on, and its mileage in that fuel's unit (km/L,
 * km/kg or km/kWh). Picking a fuel swaps in a typical mileage unless the
 * resident has typed their own.
 */
export function FuelFields({ fuelType, mileage, onChange, idPrefix }: FuelFieldsProps) {
  const legendId = useId();
  const pick = (next: FuelType) => {
    const untouched = !mileage || Number(mileage) === FUELS[fuelType].defaultMileage;
    onChange(next, untouched ? String(FUELS[next].defaultMileage) : mileage);
  };
  return (
    <div className="grid gap-3">
      <div role="group" aria-labelledby={legendId} className="grid gap-1.5">
        <span id={legendId} className="text-support font-semibold text-ink">
          Fuel
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FUEL_TYPES.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={fuelType === f}
              onClick={() => pick(f)}
              className={cn(
                'min-h-11 px-3 rounded-control border text-support font-semibold transition-colors',
                fuelType === f ? 'border-ride-deep bg-ride-tint text-ride-deep' : 'border-line-strong bg-surface text-ink hover:bg-sunken'
              )}
            >
              {FUELS[f].label}
            </button>
          ))}
        </div>
      </div>
      <Input
        id={`${idPrefix}-mileage`}
        label={`Mileage (${mileageUnit(fuelType)})`}
        type="number"
        min={FUELS[fuelType].mileageRange[0]}
        max={FUELS[fuelType].mileageRange[1]}
        step="0.5"
        inputMode="decimal"
        value={mileage}
        onChange={(e) => onChange(fuelType, e.target.value)}
        hint={`Typical: ${FUELS[fuelType].defaultMileage} ${mileageUnit(fuelType)}. Used only for the fuel-share estimate.`}
      />
    </div>
  );
}
