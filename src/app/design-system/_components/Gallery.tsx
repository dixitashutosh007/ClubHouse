'use client';

import React, { useState } from 'react';
import { Bell, Car, Inbox, Plus, Search, Settings, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, ModuleCard } from '@/components/ui/Card';
import { Checkbox, Input, Radio, RadioGroup, Select, Textarea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet, ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/States';
import { Loading } from '@/components/ui/LoadState';
import { PageContainer, SectionHeading } from '@/components/ui/Layout';
import { MODULES, MODULE_THEMES, type ModuleId } from '@/lib/design/modules';
import { cn } from '@/components/ui/cn';

const SWATCHES: { name: string; fill: string; deep: string; tint: string }[] = [
  { name: 'Terracotta', fill: 'bg-terracotta', deep: 'bg-terracotta-deep', tint: 'bg-terracotta-tint' },
  { name: 'Peacock', fill: 'bg-peacock', deep: 'bg-peacock-deep', tint: 'bg-peacock-tint' },
  { name: 'Jamun', fill: 'bg-jamun', deep: 'bg-jamun-deep', tint: 'bg-jamun-tint' },
  { name: 'Saffron', fill: 'bg-saffron', deep: 'bg-saffron-deep', tint: 'bg-saffron-tint' },
  { name: 'Coral', fill: 'bg-coral', deep: 'bg-coral-deep', tint: 'bg-coral-tint' },
  { name: 'Leaf', fill: 'bg-leaf', deep: 'bg-leaf-deep', tint: 'bg-leaf-tint' },
  { name: 'Turmeric', fill: 'bg-turmeric', deep: 'bg-turmeric-deep', tint: 'bg-turmeric-tint' },
];

const NEUTRALS = [
  { name: 'Ivory', className: 'bg-ivory' },
  { name: 'Surface', className: 'bg-surface' },
  { name: 'Sunken', className: 'bg-sunken' },
  { name: 'Line', className: 'bg-line' },
  { name: 'Line strong', className: 'bg-line-strong' },
  { name: 'Ink muted', className: 'bg-ink-muted' },
  { name: 'Ink', className: 'bg-ink' },
];

const TYPE = [
  { token: 'text-display', size: '40px', sample: 'Namaste, Rohan', display: true },
  { token: 'text-page', size: '28px', sample: 'Offer a ride', display: true },
  { token: 'text-section', size: '20px', sample: 'Coming up', display: true },
  { token: 'text-card', size: '17px', sample: 'To Manyata Tech Park', display: true },
  { token: 'text-body', size: '15px', sample: 'Neighbours share rides at their own discretion.' },
  { token: 'text-support', size: '14px', sample: 'Pick-up at the Main Gate' },
  { token: 'text-meta', size: '13px', sample: 'Tomorrow, 08:00 am · 2 seats left' },
  { token: 'text-tag', size: '12px', sample: 'COMING SOON' },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <SectionHeading title={title} />
      {children}
    </section>
  );
}

/** Every Aangan token and component in one place (development only) */
export function Gallery() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const tones: ModuleId[] = ['home', 'ride', 'classes', 'chef', 'market', 'recs'];

  return (
    <PageContainer width="wide" className="grid gap-10">
      <header className="grid gap-1">
        <p className="text-tag font-semibold uppercase tracking-wider text-home-deep">Aangan · development only</p>
        <h1 className="font-display text-page lg:text-display font-extrabold text-ink">Design system</h1>
        <p className="text-support text-ink-muted">Tokens and components for every Club House screen. See docs/DESIGN_SYSTEM.md.</p>
      </header>

      <Block title="Colour">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SWATCHES.map((s) => (
            <div key={s.name} className="rounded-card border border-line overflow-hidden bg-surface">
              <div className={cn('h-14', s.fill)} />
              <div className="grid grid-cols-2">
                <div className={cn('h-8', s.deep)} />
                <div className={cn('h-8', s.tint)} />
              </div>
              <p className="px-3 py-2 text-meta font-semibold text-ink">{s.name}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {NEUTRALS.map((n) => (
            <div key={n.name} className="grid gap-1">
              <div className={cn('h-10 rounded-control border border-line', n.className)} />
              <span className="text-tag text-ink-muted">{n.name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge status="success">Approved</Badge>
          <Badge status="warning">Waiting</Badge>
          <Badge status="danger">Rejected</Badge>
          <Badge status="info">New</Badge>
          <Badge>Coming soon</Badge>
          {tones.map((t) => (
            <Badge key={t} tone={t}>
              {t === 'home' ? 'Club House' : MODULES.find((m) => m.id === t)?.name}
            </Badge>
          ))}
        </div>
      </Block>

      <Block title="Typography">
        <Card padding="lg" className="grid gap-3">
          {TYPE.map((t) => (
            <div key={t.token} className="grid sm:grid-cols-[150px_1fr] gap-1 items-baseline">
              <code className="text-meta text-ink-muted">
                {t.token} · {t.size}
              </code>
              <span className={cn(t.token, t.display ? 'font-display font-bold' : '', 'text-ink')}>{t.sample}</span>
            </div>
          ))}
          <p className="text-body text-ink">
            Hindi and Kannada use system fonts: नमस्ते, पड़ोसी · ನಮಸ್ಕಾರ, ನೆರೆಹೊರೆಯವರೇ
          </p>
        </Card>
      </Block>

      <Block title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button icon={Plus}>Primary</Button>
          <Button variant="tonal">Tonal</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button
            loading={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => setBusy(false), 1500);
            }}
          >
            {busy ? 'Saving…' : 'Press to load'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tones.map((t) => (
            <Button key={t} tone={t} size="sm">
              {t === 'home' ? 'Club House' : MODULES.find((m) => m.id === t)?.name}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <IconButton icon={Bell} label="Notifications" dot />
          <IconButton icon={Search} label="Search" variant="secondary" />
          <IconButton icon={Car} label="RideShare" variant="tonal" tone="ride" />
          <IconButton icon={Settings} label="Settings" size="sm" />
          <IconButton icon={X} label="Close" disabled />
        </div>
      </Block>

      <Block title="Cards">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} />
          ))}
        </div>
        <Card className="grid gap-2">
          <div className="flex items-center gap-3">
            <Avatar name="Ashutosh Dixit" size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-card font-bold">To Manyata Tech Park</p>
              <p className="text-meta text-ink-muted">Tomorrow, 08:00 am · Ashutosh D.</p>
            </div>
            <Badge tone="ride">2 seats</Badge>
          </div>
        </Card>
      </Block>

      <Block title="Forms">
        <Card padding="lg" className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" placeholder="As your neighbours know you" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Flat number" hint="Tower and flat, e.g. B-1204" required />
          <Input label="Mobile number" error="Enter a 10-digit mobile number" defaultValue="98450" />
          <Select label="Seats" defaultValue="2">
            <option value="1">1 seat</option>
            <option value="2">2 seats</option>
            <option value="3">3 seats</option>
          </Select>
          <Textarea label="About the class" hint="Up to 50 words" wrapperClassName="sm:col-span-2" />
          <div className="grid gap-1">
            <Checkbox label="Repeat every week" description="Rides are added a week ahead" />
            <Checkbox label="Disabled option" disabled />
          </div>
          <RadioGroup legend="Who can join">
            <Radio name="who" label="Anyone" defaultChecked />
            <Radio name="who" label="Women only" />
          </RadioGroup>
        </Card>
      </Block>

      <Block title="Dialogs and messages">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open bottom sheet
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Confirm dialog
          </Button>
          <Button variant="secondary" onClick={() => toast.show('Ride offered. Neighbours can now request a seat.')}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast.show('Could not save. Check your connection and try again.', 'error')}>
            Error toast
          </Button>
        </div>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Class details" description="Dialogs are centred cards.">
          <Button fullWidth onClick={() => setDialog(false)}>
            Done
          </Button>
        </Dialog>
        <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Edit ride" description="On phones this slides up from the bottom.">
          <div className="grid gap-3">
            <Input label="Destination" defaultValue="Manyata Tech Park" />
            <Button tone="ride" fullWidth onClick={() => setSheet(false)}>
              Save
            </Button>
          </div>
        </BottomSheet>
        <ConfirmDialog
          open={confirm}
          title="Cancel this ride?"
          description="Riders who joined will be told."
          confirmLabel="Cancel ride"
          cancelLabel="Keep ride"
          destructive
          onCancel={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
        />
      </Block>

      <Block title="States">
        <div className="grid sm:grid-cols-2 gap-3">
          <EmptyState icon={Inbox} title="No rides yet" description="Offer the empty seats in your car." tone="ride" action={<Button tone="ride">Offer a ride</Button>} />
          <div className="grid gap-3 content-start">
            <SkeletonCard label="Loading rides" />
            <ErrorState message="Could not load rides. Check your connection." onRetry={() => toast.show('Retrying…', 'info')} />
            <Loading label="Loading classes…" />
          </div>
        </div>
      </Block>

      <Block title="Module identities">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {(['home', ...MODULES.map((m) => m.id)] as ModuleId[]).map((id) => (
            <div key={id} className={cn('rounded-card p-3 grid gap-1', MODULE_THEMES[id].tint)}>
              <span className={cn('text-meta font-bold', MODULE_THEMES[id].text)}>
                {id === 'home' ? 'Club House' : MODULES.find((m) => m.id === id)?.name}
              </span>
              <span className={cn('h-6 rounded-control', MODULE_THEMES[id].fill)} />
            </div>
          ))}
        </div>
      </Block>
    </PageContainer>
  );
}
