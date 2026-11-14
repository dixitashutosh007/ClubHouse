'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useState, useEffect, useId, useRef } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { PlaceSuggestion } from '@/lib/services/places-data';

interface PlacesAutocompleteInputProps {
  value: string;
  onChange: (value: string, suggestion?: PlaceSuggestion) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function PlacesAutocompleteInput({
  value,
  onChange,
  placeholder = 'Search destination (e.g. Manyata, Bagmane, ITPL...)',
  label = 'Destination Hub',
  required = false,
}: PlacesAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchQuery: string) => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/v1/places/autocomplete?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setIsOpen(true);
      }
    } catch (e) {
      console.error('Failed to load places suggestions', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (val.trim().length > 1) {
      fetchSuggestions(val);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelectSuggestion = async (item: PlaceSuggestion) => {
    setIsOpen(false);

    // If item already has non-default coordinates, return immediately
    if (item.lat !== 12.9716 || item.lng !== 77.5946) {
      onChange(item.primaryText, item);
      return;
    }

    // Resolve exact geocode details
    try {
      const res = await apiFetch(`/api/v1/places/autocomplete?placeId=${encodeURIComponent(item.placeId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.location) {
          onChange(item.primaryText, {
            ...item,
            lat: data.location.lat,
            lng: data.location.lng,
            secondaryText: data.location.formattedAddress || item.secondaryText,
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Place details resolution error', e);
    }

    // Coordinates unknown: pass the text only so forms ask for another pick
    onChange(item.primaryText);
  };

  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full grid gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-support font-semibold text-ink block">
          {label}
        </label>
      )}

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
          <MapPin className="w-4 h-4 text-ride-deep" aria-hidden="true" />
        </div>

        <input
          id={inputId}
          type="text"
          required={required}
          value={value}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
            else fetchSuggestions(value);
          }}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full h-11 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-ride/30 focus:border-ride-deep pl-9 pr-10"
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <Loader2 className="w-4 h-4 text-ink-muted animate-spin" aria-hidden="true" />}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear location"
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-sunken"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-control border border-line bg-surface shadow-overlay text-support">
          <div className="px-3 py-1.5 bg-sunken border-b border-line text-tag font-semibold text-ink-muted uppercase tracking-wider">
            Suggested Tech Parks & Hubs
          </div>
          {suggestions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full text-left px-3 py-2.5 min-h-11 hover:bg-ride-tint flex items-start gap-2.5 border-b border-line last:border-b-0 transition-colors"
            >
              <MapPin className="w-4 h-4 text-ride-deep shrink-0 mt-0.5" aria-hidden="true" />
              <div className="truncate">
                <span className="font-semibold text-ink block truncate">
                  {item.primaryText}
                </span>
                <span className="text-meta text-ink-muted block truncate">
                  {item.secondaryText}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
