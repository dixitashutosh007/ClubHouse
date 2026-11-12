import { describe, it, expect } from 'vitest';
import { offererGreeting, seekerGreeting, smsLink, telLink, whatsAppLink, whatsAppNumber } from '../contact';
import { rideMessages } from '@/lib/services/ride-messages';
import { tripShareText } from '@/components/TripSafetyActions';

describe('contact links', () => {
  it('formats Indian numbers for WhatsApp and the dialler', () => {
    expect(whatsAppNumber('+91 98111 22233')).toBe('919811122233');
    expect(whatsAppNumber('9811122233')).toBe('919811122233');
    expect(telLink('+91 98111-22233')).toBe('tel:+919811122233');
  });

  it('pre-fills WhatsApp and SMS messages safely', () => {
    expect(whatsAppLink('Hi & bye?', '+919811122233')).toBe('https://wa.me/919811122233?text=Hi%20%26%20bye%3F');
    expect(whatsAppLink('Trip')).toBe('https://wa.me/?text=Trip');
    expect(smsLink('On my way')).toBe('sms:?&body=On%20my%20way');
  });
});

describe('ride message templates', () => {
  const ctx = {
    toName: 'Ashutosh Dixit',
    fromName: 'Priya Sharma',
    societyName: 'Mahaveer Ranches',
    destination: 'Manyata Tech Park',
    when: 'Tomorrow, 9:00 am',
    meetingPoint: 'Main Gate',
  };

  it('thanks the offering resident and names the meeting point', () => {
    const text = seekerGreeting(ctx);
    expect(text).toContain('Hi Ashutosh, this is Priya from Mahaveer Ranches');
    expect(text).toContain('kindly accepting');
    expect(text).toContain('Main Gate');
  });

  it('welcomes the joining resident', () => {
    expect(offererGreeting({ ...ctx, toName: 'Priya Sharma', fromName: 'Ashutosh Dixit' })).toContain(
      "Happy to have you along to Manyata Tech Park (Tomorrow, 9:00 am). Let's meet at Main Gate."
    );
  });

  it('shares trip details with the car for family', () => {
    const text = tripShareText({
      role: 'SEEKER',
      companionName: 'Ashutosh Dixit',
      vehicle: 'White Hyundai Creta',
      plate: 'KA-04-MM-8921',
      from: 'Main Gate',
      to: 'Manyata Tech Park',
      when: 'Tomorrow, 9:00 am',
    });
    expect(text).toContain('White Hyundai Creta, KA-04-MM-8921');
    expect(text).toContain('from Main Gate to Manyata Tech Park');
  });

  it('never calls a neighbour a driver or passenger in notifications', () => {
    const all = [
      rideMessages.requested('Priya Sharma', 1, 'ITPL'),
      rideMessages.accepted('Ashutosh Dixit', 'ITPL'),
      rideMessages.declined('ITPL', true),
      rideMessages.declined('ITPL', false),
      rideMessages.seekerCancelled('Priya Sharma', 2, 'ITPL'),
      rideMessages.rideCancelled('Ashutosh Dixit', 'ITPL', 'Thu, 13 Nov'),
    ];
    for (const { title, body } of all) expect(`${title} ${body}`).not.toMatch(/driver|passenger/i);
    expect(rideMessages.accepted('Ashutosh Dixit', 'ITPL').body).toContain('graciously accepted');
    expect(rideMessages.requested('Priya Sharma', 1, 'ITPL').body).toContain('requesting to tag along with you to ITPL');
  });
});
