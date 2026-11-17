/**
 * Rules for circle messages, shared by the API and the message box so a
 * resident sees the same limits before sending.
 */
export const MAX_MESSAGE_WORDS = 150;
export const MAX_MESSAGE_CHARS = 1500;
/** Days of history kept */
export const MESSAGE_HISTORY_DAYS = 30;
/** One message per this many seconds, per resident */
export const MESSAGE_GAP_SECONDS = 10;

// Pictographs (😀, ❤️, 👍…), flags, keycaps and the variation selector that turns symbols into emoji
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}⃣️]/u;

export function hasEmoji(text: string): boolean {
  return EMOJI.test(text);
}

export function messageWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Why a message can't be sent, or null if it is fine */
export function messageProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return 'Type a message.';
  if (hasEmoji(t)) return 'Emoji are not allowed in circle messages.';
  if (messageWords(t) > MAX_MESSAGE_WORDS) return `Keep messages within ${MAX_MESSAGE_WORDS} words.`;
  if (t.length > MAX_MESSAGE_CHARS) return `Keep messages within ${MAX_MESSAGE_CHARS} characters.`;
  return null;
}

/** Splits text into plain parts and https/http links, so links can be shown as tappable */
export function linkParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const re = /\bhttps?:\/\/[^\s<>"]+/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    // Leave trailing punctuation out of the link ("see https://x.com.")
    const url = m[0].replace(/[.,;:!?)\]]+$/, '');
    const start = m.index!;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
