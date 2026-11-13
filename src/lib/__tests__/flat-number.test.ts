import { describe, it, expect } from 'vitest';
import { flatExample, flatNumberError, normalizeFlat, parseFlat } from '../flat-number';
import { describeAuditEvent } from '../audit-text';

const towers = { towers: ['A1', 'A10', 'B', 'F'], minNumber: 101, maxNumber: 2404 };
const noTowers = { towers: [], minNumber: 1, maxNumber: 600 };

describe('flat numbers', () => {
  it('reads tower and number in common spellings', () => {
    expect(parseFlat('A1-1203', towers)).toEqual({ tower: 'A1', number: '1203' });
    expect(parseFlat('a10 405', towers)).toEqual({ tower: 'A10', number: '405' });
    expect(parseFlat('B405', towers)).toEqual({ tower: 'B', number: '405' });
  });

  it('checks the tower and the number range', () => {
    expect(flatNumberError('A1-1203', towers)).toBeNull();
    expect(flatNumberError('Z-405', towers)).toMatch(/Choose your tower/);
    expect(flatNumberError('B-99', towers)).toMatch(/101 to 2404/);
    expect(flatNumberError('B-12a', towers)).toMatch(/digits/);
    expect(flatNumberError('443', noTowers)).toBeNull();
    expect(flatNumberError('A-443', noTowers)).toMatch(/digits/);
  });

  it('stores one standard form', () => {
    expect(normalizeFlat('a1 01203', towers)).toBe('A1-1203');
    expect(normalizeFlat('443', noTowers)).toBe('443');
    expect(flatExample(towers)).toBe('A1-1203');
  });
});

describe('activity log sentences', () => {
  it('reads like a sentence and never shows raw data', () => {
    expect(
      describeAuditEvent({ action: 'RESIDENT_APPROVE', actorName: 'Vikram Mehta', subjectName: 'Priya Sharma', metadata: { targetUserId: 'u1' } })
    ).toEqual({ text: 'Vikram Mehta approved Priya Sharma', tone: 'good' });
    expect(describeAuditEvent({ action: 'RIDE_OFFERED', actorName: 'Ashutosh', metadata: { destinationName: 'ITPL' } }).text).toBe(
      'Ashutosh offered a ride to ITPL'
    );
    const unknown = describeAuditEvent({ action: 'SOMETHING_NEW', actorName: 'Admin', metadata: { a: 1 } });
    expect(unknown.text).toBe('Admin: Something new');
    expect(unknown.text).not.toContain('{');
  });
});

describe('flat numbers typed before the setup existed', () => {
  it('understands words like Tower and Flat', () => {
    const abc = { towers: ['A', 'B', 'C'], minNumber: 101, maxNumber: 1804 };
    expect(parseFlat('Tower C-302', abc)).toEqual({ tower: 'C', number: '302' });
    expect(normalizeFlat('Tower C - 302', abc)).toBe('C-302');
    expect(parseFlat('Flat 443', { towers: [], minNumber: 1, maxNumber: 600 })).toEqual({ tower: undefined, number: '443' });
  });
});
