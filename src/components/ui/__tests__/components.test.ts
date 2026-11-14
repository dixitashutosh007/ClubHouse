import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { Bell, Plus } from 'lucide-react';
import { Button, IconButton } from '../Button';
import { Input, Select, Checkbox } from '../Field';
import { ModuleCard } from '../Card';
import { Badge } from '../Badge';
import { ErrorState } from '../States';
import { MODULES } from '@/lib/design/modules';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('Aangan components', () => {
  it('buttons are real buttons that cannot be pressed while busy or disabled', () => {
    const idle = html(h(Button, { icon: Plus, children: 'Offer a ride' }));
    expect(idle).toMatch(/^<button type="button"/);
    const busy = html(h(Button, { loading: true, children: 'Saving' }));
    expect(busy).toContain('disabled=""');
    expect(busy).toContain('aria-busy="true"');
    expect(html(h(Button, { disabled: true, children: 'Nope' }))).toContain('disabled=""');
  });

  it('a button with href is a link, and module tones use their deep colour', () => {
    const link = html(h(Button, { href: '/rides', tone: 'ride', children: 'Find a ride' }));
    expect(link).toMatch(/^<a /);
    expect(link).toContain('href="/rides"');
    expect(link).toContain('bg-ride-deep');
  });

  it('icon buttons always have an accessible name and a 44px target', () => {
    const out = html(h(IconButton, { icon: Bell, label: 'Notifications' }));
    expect(out).toContain('aria-label="Notifications"');
    expect(out).toContain('w-11 h-11');
  });

  it('fields tie their label, hint and error to the control', () => {
    const out = html(h(Input, { label: 'Flat number', hint: 'e.g. B-1204', error: 'Enter your flat', id: 'flat' }));
    expect(out).toContain('<label for="flat"');
    expect(out).toContain('id="flat"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('aria-describedby="flat-hint flat-error"');
    expect(out).toContain('id="flat-error" role="alert"');
  });

  it('fields without an error are not marked invalid', () => {
    const out = html(h(Select, { label: 'Seats', id: 'seats', children: h('option', { value: '1' }, '1 seat') }));
    expect(out).not.toContain('aria-invalid');
    expect(out).toContain('<label for="seats"');
  });

  it('checkbox labels wrap the input so the whole row is the target', () => {
    const out = html(h(Checkbox, { label: 'Repeat every week', id: 'repeat' }));
    expect(out).toMatch(/<label for="repeat"[^>]*min-h-11/);
    expect(out).toContain('type="checkbox"');
  });

  it('live apps link to their page; Coming soon apps are not links', () => {
    const ride = MODULES.find((m) => m.id === 'ride')!;
    const chef = MODULES.find((m) => m.id === 'chef')!;
    expect(html(h(ModuleCard, { module: ride }))).toContain('href="/rides"');
    const soon = html(h(ModuleCard, { module: chef }));
    expect(soon).not.toContain('href=');
    expect(soon).toContain('Coming soon');
  });

  it('badges and errors use the semantic tokens', () => {
    expect(html(h(Badge, { status: 'success', children: 'Approved' }))).toContain('text-success');
    const err = html(h(ErrorState, { message: 'Could not load', onRetry: () => {} }));
    expect(err).toContain('role="alert"');
    expect(err).toContain('Try again');
  });
});

describe('cn()', () => {
  it('keeps an Aangan text size next to a text colour', async () => {
    const { cn } = await import('../cn');
    expect(cn('text-tag', 'text-success')).toBe('text-tag text-success');
    expect(cn('text-body', 'text-ink-inverse')).toBe('text-body text-ink-inverse');
    expect(cn('rounded-card', 'rounded-control')).toBe('rounded-control');
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});
