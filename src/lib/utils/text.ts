/** Place names are plain text: tags someone typed (e.g. "<b>") are dropped, not shown */
export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
