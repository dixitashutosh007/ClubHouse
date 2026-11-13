import { FlatNumberConfig } from '@/types';

/**
 * Flat numbers follow each society's setup: its towers or blocks (if any)
 * and the range of flat numbers, e.g. "A1-1203", "B-405" or just "443".
 */

export function formatFlat(tower: string | undefined, number: string | number): string {
  const n = String(number).trim();
  return tower ? `${tower}-${n}` : n;
}

/** Splits a stored flat number into its tower and number for the society's setup */
export function parseFlat(value: string, config: FlatNumberConfig): { tower?: string; number: string } {
  // Older entries were typed freely, e.g. "Tower C - 302" or "Flat 443"
  const v = value.trim().replace(/^(tower|block|wing|flat|apt|apartment)\b[\s.:-]*/i, '');
  // Longest tower names first, so "A10" isn't read as tower "A1"
  const tower = [...config.towers]
    .sort((a, b) => b.length - a.length)
    .find((t) => v.toUpperCase().startsWith(t.toUpperCase()) && /^[\s-]*\d/.test(v.slice(t.length)));
  const rest = tower ? v.slice(tower.length) : v;
  return { tower, number: rest.replace(/^[\s-]+/, '') };
}

/** Why this flat number doesn't fit the society's setup, or null if it does */
export function flatNumberError(value: string, config: FlatNumberConfig): string | null {
  const { tower, number } = parseFlat(value, config);
  if (config.towers.length > 0 && !tower) return `Choose your tower: ${config.towers.join(', ')}`;
  if (!/^\d+$/.test(number)) return 'Enter your flat number in digits';
  const n = Number(number);
  if (n < config.minNumber || n > config.maxNumber) {
    return `Flat numbers here run from ${config.minNumber} to ${config.maxNumber}`;
  }
  return null;
}

/** The flat number in the society's standard form, e.g. "a1 1203" → "A1-1203" */
export function normalizeFlat(value: string, config: FlatNumberConfig): string {
  const { tower, number } = parseFlat(value, config);
  return formatFlat(tower, String(Number(number)));
}

export function flatExample(config: FlatNumberConfig): string {
  return formatFlat(config.towers[0], config.maxNumber >= 1000 ? Math.min(config.maxNumber, 1203) : config.minNumber);
}
