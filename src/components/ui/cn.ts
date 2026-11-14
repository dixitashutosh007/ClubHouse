import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge needs to know the Aangan type scale (globals.css), or it
 * reads `text-tag` as a colour and drops it next to `text-success`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'page', 'section', 'card', 'body', 'support', 'meta', 'tag'],
      radius: ['control', 'card', 'sheet'],
      shadow: ['raised', 'overlay'],
    },
  },
});

/** Joins class names; later Tailwind classes win over earlier ones (e.g. a caller's padding) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
