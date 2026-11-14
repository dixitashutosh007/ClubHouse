import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { MODULE_THEMES, MODULES } from '../modules';

/** Reads the Aangan colour tokens straight from globals.css, following var() aliases */
function loadTokens(): Record<string, string> {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const raw: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) raw[m[1]] = m[2].trim();
  const resolve = (name: string, depth = 0): string => {
    const value = raw[name];
    if (!value) throw new Error(`Unknown colour token --color-${name}`);
    const alias = value.match(/^var\(--color-([a-z0-9-]+)\)$/);
    return alias && depth < 5 ? resolve(alias[1], depth + 1) : value.toLowerCase();
  };
  return Object.fromEntries(Object.keys(raw).map((k) => [k, resolve(k)]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const t = loadTokens();
const TEXT = 4.5; // WCAG AA, normal text
const UI = 3; // WCAG AA, large text and control edges

const HUES = ['terracotta', 'saffron', 'peacock', 'turmeric', 'leaf', 'jamun', 'coral'];
const PAGES = ['ivory', 'surface'];

describe('Aangan colour contrast (WCAG AA)', () => {
  it('body text reads on every surface', () => {
    for (const fg of ['ink', 'ink-muted']) {
      for (const bg of [...PAGES, 'sunken']) {
        expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(TEXT);
      }
    }
  });

  it('every deep shade works as text on the page, on its tint, and under white text', () => {
    for (const hue of HUES) {
      for (const bg of [...PAGES, `${hue}-tint`]) {
        expect(contrast(t[`${hue}-deep`], t[bg]), `${hue}-deep on ${bg}`).toBeGreaterThanOrEqual(TEXT);
      }
      expect(contrast(t['ink-inverse'], t[`${hue}-deep`]), `white on ${hue}-deep`).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('status colours read on their own backgrounds', () => {
    for (const s of ['success', 'warning', 'danger', 'info']) {
      expect(contrast(t[s], t[`${s}-bg`]), `${s} on ${s}-bg`).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(t[s], t.surface), `${s} on surface`).toBeGreaterThanOrEqual(TEXT);
    }
    expect(contrast(t['ink-inverse'], t.danger), 'white on danger').toBeGreaterThanOrEqual(TEXT);
  });

  it('form field borders and the focus ring stand out (3:1)', () => {
    for (const bg of PAGES) {
      expect(contrast(t['line-strong'], t[bg]), `line-strong on ${bg}`).toBeGreaterThanOrEqual(UI);
      expect(contrast(t['terracotta-deep'], t[bg]), `focus ring on ${bg}`).toBeGreaterThanOrEqual(UI);
    }
  });

  it('module tiles use a fill/text pair that passes for normal text', () => {
    const colourOf = (cls: string, prefix: 'bg' | 'text') => {
      const match = cls.split(' ').find((c) => c.startsWith(`${prefix}-`) && !c.includes(':'));
      return t[match!.slice(prefix.length + 1)];
    };
    for (const [id, theme] of Object.entries(MODULE_THEMES)) {
      expect(contrast(colourOf(theme.fill, 'text'), colourOf(theme.fill, 'bg')), `${id} tile`).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(colourOf(theme.solid, 'text'), colourOf(theme.solid, 'bg')), `${id} button`).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('only RideShare and Classes are live; every other app is Coming soon with no link', () => {
    expect(MODULES.filter((m) => m.status === 'live').map((m) => m.id)).toEqual(['ride', 'classes']);
    for (const m of MODULES.filter((x) => x.status === 'coming-soon')) expect(m.href).toBeUndefined();
  });
});
