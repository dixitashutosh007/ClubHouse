/**
 * Links for contacting a fellow resident or sharing a trip. Nothing is sent
 * by the app: these open the phone's dialler, WhatsApp or SMS app.
 */

/** Digits only, with India's country code, as WhatsApp expects ("919811122233") */
export function whatsAppNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export function telLink(mobile: string): string {
  return `tel:${mobile.replace(/[^\d+]/g, '')}`;
}

/** WhatsApp chat with a number, or a contact picker when no number is given */
export function whatsAppLink(text: string, mobile?: string): string {
  const to = mobile ? whatsAppNumber(mobile) : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** A text message with the body filled in; the person picks the recipient */
export function smsLink(text: string): string {
  // "?&body=" works on both iOS and Android
  return `sms:?&body=${encodeURIComponent(text)}`;
}

interface RideMessageContext {
  /** The other resident's name */
  toName: string;
  /** The sender's name */
  fromName: string;
  societyName?: string;
  destination: string;
  /** e.g. "Tomorrow, 8:30 am" */
  when: string;
  meetingPoint?: string;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/** From a resident joining a ride, to the neighbour who offered it */
export function seekerGreeting(ctx: RideMessageContext): string {
  const from = ctx.societyName ? `${first(ctx.fromName)} from ${ctx.societyName}` : first(ctx.fromName);
  return (
    `Hi ${first(ctx.toName)}, this is ${from}. Thank you so much for kindly accepting my request ` +
    `to ride along to ${ctx.destination} (${ctx.when}).` +
    (ctx.meetingPoint ? ` I'll be at ${ctx.meetingPoint} on time.` : ' Where shall I meet you?') +
    ' See you then!'
  );
}

/** From the resident offering a ride, to a neighbour joining it */
export function offererGreeting(ctx: RideMessageContext): string {
  const from = ctx.societyName ? `${first(ctx.fromName)} from ${ctx.societyName}` : first(ctx.fromName);
  return (
    `Hi ${first(ctx.toName)}, this is ${from}. Happy to have you along to ${ctx.destination} (${ctx.when}).` +
    (ctx.meetingPoint ? ` Let's meet at ${ctx.meetingPoint}.` : ' Let me know where to pick you up.') +
    ' See you then!'
  );
}
