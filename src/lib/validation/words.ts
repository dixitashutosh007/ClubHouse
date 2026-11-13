/** Class descriptions stay short so they read well on a phone */
export const MAX_CLASS_DESCRIPTION_WORDS = 50;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
