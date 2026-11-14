'use client';

import React, { useState } from 'react';
import { AlertCircle, Bike, Car, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { validateIndianRegistration } from '@/lib/utils/indian-vehicle';
import { Vehicle } from '@/types';

interface VehiclesSectionProps {
  vehicles: Vehicle[];
  onAdded: () => Promise<void>;
  notify: (type: 'success' | 'error', text: string) => void;
}


/**
 * Registered vehicles and the add-vehicle form. Rendered inside the profile
 * form, so its controls are plain buttons rather than a nested <form>.
 */
export function VehiclesSection({ vehicles, onAdded, notify }: VehiclesSectionProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<'CAR' | 'TWO_WHEELER'>('CAR');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [registration, setRegistration] = useState('');
  const [capacity, setCapacity] = useState(3);
  const [mileage, setMileage] = useState('15');
  const [saving, setSaving] = useState(false);
  // Problems with the new vehicle show next to its Save button
  const [error, setError] = useState('');

  const addVehicle = async () => {
    setError('');
    if (!make.trim() || !model.trim() || !registration.trim()) {
      setError('Please fill in make, model and registration number.');
      return;
    }
    const regCheck = validateIndianRegistration(registration);
    if (!regCheck.isValid) {
      setError(regCheck.error || 'Please enter a valid Indian vehicle number (e.g. KA-04-MB-1234).');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/user/vehicles', {
        json: {
          type,
          make: make.trim(),
          model: model.trim(),
          color: color.trim() || undefined,
          registrationNumber: registration.toUpperCase(),
          capacity: type === 'TWO_WHEELER' ? 1 : capacity,
          mileageKmPerLitre: mileage ? Number(mileage) : undefined,
        },
      }).catch(() => null);
      if (!res) {
        setError('Connection problem. Check your internet and try again.');
        return;
      }
      if (!res.ok) {
        setError(await apiErrorMessage(res, 'Failed to add vehicle'));
        return;
      }
      setShowAdd(false);
      setMake('');
      setModel('');
      setColor('');
      setRegistration('');
      await onAdded();
      notify('success', 'Vehicle registered successfully!');
    } finally {
      setSaving(false);
    }
  };

  const choice = (on: boolean) =>
    cn(
      'min-h-11 px-3 rounded-control border flex items-center justify-center gap-2 text-support font-semibold transition-colors',
      on ? 'border-ride-deep bg-ride-tint text-ride-deep' : 'border-line-strong bg-surface text-ink hover:bg-sunken'
    );

  return (
    <div className="grid gap-3">
      {vehicles.length === 0 ? (
        <p className="p-4 rounded-control border border-dashed border-line-strong text-support text-ink-muted text-center">
          No vehicles yet. Add your car or bike to offer rides to neighbours.
        </p>
      ) : (
        <ul className="grid gap-2">
          {vehicles.map((v) => (
            <li key={v.id} className="flex items-center gap-3 p-3 rounded-control border border-line bg-surface">
              <span className="w-10 h-10 rounded-control bg-ride-tint text-ride-deep flex items-center justify-center shrink-0" aria-hidden="true">
                {v.type === 'TWO_WHEELER' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-support font-bold text-ink">{[v.color, v.make, v.model].filter(Boolean).join(' ')}</span>
                <span className="block text-meta font-mono text-ink-muted">
                  {v.registrationNumber} · {v.capacity} seat{v.capacity > 1 ? 's' : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!showAdd ? (
        <Button variant="tonal" tone="ride" icon={Plus} onClick={() => setShowAdd(true)} aria-expanded={false} className="justify-self-start">
          Add a vehicle
        </Button>
      ) : (
        <fieldset className="grid gap-3 p-4 rounded-card bg-ride-tint/60 border border-line">
          <legend className="px-1 text-support font-semibold text-ink">New vehicle</legend>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Vehicle type">
            {(
              [
                ['CAR', 'Car', 3, Car],
                ['TWO_WHEELER', 'Two-wheeler', 1, Bike],
              ] as const
            ).map(([value, label, seats, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => {
                  setType(value);
                  setCapacity(seats);
                }}
                className={choice(type === value)}
              >
                <Icon className="w-5 h-5" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="vehicle-make" label="Make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Hyundai" />
            <Input id="vehicle-model" label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Creta" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="vehicle-registration"
              label="Number plate"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              placeholder="KA-04-MB-1234"
              className="font-mono font-semibold uppercase"
            />
            <Input id="vehicle-colour" label="Colour" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. White" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              id="vehicle-seats"
              label="Seats for residents"
              value={type === 'TWO_WHEELER' ? 1 : capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              disabled={type === 'TWO_WHEELER'}
            >
              {type === 'TWO_WHEELER' ? (
                <option value={1}>1 pillion seat</option>
              ) : (
                [1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} seat{n > 1 ? 's' : ''}
                  </option>
                ))
              )}
            </Select>
            <Input
              id="vehicle-mileage"
              label="Mileage (km/L)"
              type="number"
              min="5"
              max="60"
              step="0.5"
              inputMode="decimal"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-meta font-medium text-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAdd(false);
                setError('');
              }}
            >
              Cancel
            </Button>
            <Button tone="ride" loading={saving} onClick={addVehicle}>
              Save vehicle
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
