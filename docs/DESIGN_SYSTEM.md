# Aangan: the Club House design system

Aangan (the shared courtyard of an Indian home) is the visual language for every Club House
screen: warm ivory surfaces, ink text, and one colour identity per app. Live reference:
`/design-system` in development (it returns 404 in production).

## Where things live

| What | Where |
|---|---|
| Tokens (colours, type, radii, shadows) | `src/app/globals.css` (`@theme`) |
| Fonts | `src/app/layout.tsx` (`next/font/google`) |
| App list and colour identities | `src/lib/design/modules.ts` |
| Components | `src/components/ui/` |
| Contrast guard | `src/lib/design/__tests__/contrast.test.ts` |

Tokens become Tailwind classes: `--color-ride-deep` → `text-ride-deep`, `bg-ride-deep`;
`--radius-card` → `rounded-card`; `--text-body` → `text-body`.

## Rules

1. **Use tokens, not raw colours.** New code never uses `slate-*`, `zinc-*`, `emerald-*` or hex values.
   Older screens still do; they move over in Phases 2–5.
2. **Use `src/components/ui/` before writing a button, field, card or state by hand.**
3. **Colour has a job.** Ivory, white and ink carry the content. Module colours mark identity
   (icons, headings, selected navigation, app tiles, the main action). One module-coloured hero per
   screen at most.
4. **Fill, deep, tint.** Every hue has three shades:
   - **fill**: tiles, icon chips, large text
   - **deep**: text, links and filled buttons (≥ 4.5:1 on ivory and white)
   - **tint**: soft backgrounds behind deep text
5. **Nothing smaller than 12px**, and secondary text uses `ink-muted` (5.6:1), never a lighter grey.
6. **Touch targets are 44px** (`Button` md/lg, `IconButton` md, checkbox and radio rows).
   The 36px `sm` sizes are for dense desktop layouts only.
7. **Coming soon is never a link.** Only modules with `status: 'live'` in `modules.ts` navigate.

## Colour

| Token | Fill | Deep | Tint | Notes |
|---|---|---|---|---|
| Terracotta | `#E76F51` | `#B4482A` | `#FDEBE4` | Brand. Tiles use the deep shade: fill + ink is only 4.26:1 |
| Peacock | `#167D9A` | `#0F6A84` | `#DDF0F5` | White on fill 4.74:1 |
| Jamun | `#7952A8` | `#6A4596` | `#EEE6F7` | White on fill 5.86:1 |
| Saffron | `#F4A62A` | `#9A5800` | `#FDEBCF` | Ink on fill 6.48:1 |
| Coral | `#E98470` | `#B04A35` | `#FCE9E4` | Ink on fill 5.01:1 |
| Leaf | `#70A86B` | `#3A6F37` | `#E3F0E1` | Ink on fill 4.70:1 |
| Turmeric | `#E9C46A` | `#7D6000` | `#FBF1D3` | Warning state and small highlights |

### Module identities

| Module | Token prefix | Hue | Status |
|---|---|---|---|
| Club House / Home | `home` | Terracotta | Live |
| RideShare | `ride` | Peacock | Live |
| Classes | `classes` | Jamun | Live |
| Home Chef | `chef` | Saffron | Coming soon |
| Marketplace | `market` | Coral | Coming soon |
| Recommendations | `recs` | Leaf | Coming soon |
| Community | `community` | Terracotta | Coming soon |

`MODULE_THEMES[id]` gives ready-made class strings: `fill`, `text`, `tint`, `solid` (button),
`tonal` (button), `selected` (navigation) and `border`.

### Neutrals and status

| Token | Value | Use |
|---|---|---|
| `ivory` | `#FFF8ED` | Page background |
| `surface` | `#FFFFFF` | Cards, sheets, dialogs |
| `sunken` | `#F7EEDF` | Wells, table headers, skeletons |
| `line` | `#EADFCF` | Card borders and dividers (decorative) |
| `line-strong` | `#8E816D` | Form field borders (≥ 3:1) |
| `ink` | `#263238` | Text (12.5:1 on ivory) |
| `ink-muted` | `#5B6670` | Secondary text (5.6:1) |
| `success` / `success-bg` | `#3A6F37` / `#E3F0E1` | Approved, done |
| `warning` / `warning-bg` | `#7D6000` / `#FBF1D3` | Waiting, needs attention |
| `danger` / `danger-bg` | `#B42318` / `#FCE4E1` | Errors, SOS, destructive actions |
| `info` / `info-bg` | `#0F6A84` / `#DDF0F5` | Neutral information |

## Typography

- **Headings:** Bricolage Grotesque (`font-display`).
- **Everything else:** Plus Jakarta Sans (`font-sans`, the default).
- Both are self-hosted through `next/font`. Hindi and Kannada fall back to system fonts
  (Noto Sans Devanagari / Kannada, Nirmala UI, Kohinoor Devanagari).

| Class | Size | Use |
|---|---|---|
| `text-display` | 40px | Home greeting on large screens |
| `text-page` | 28px | Page titles |
| `text-section` | 20px | Section headings |
| `text-card` | 17px | Card titles |
| `text-body` | 15px | Body text (use `lg:text-base` for 16px on desktop) |
| `text-support` | 14px | Labels, secondary sentences |
| `text-meta` | 13px | Times, counts, bylines |
| `text-tag` | 12px | Badges only. The minimum size |

## Spacing, radius, elevation

- **Spacing:** Tailwind's 4px scale. Common steps are 2, 3, 4, 5, 6, 8 and 10 (8–40px).
  Page gutters are 16px on phones, 24px from `sm` and 32px from `lg` (`PageContainer`).
- **Radius:**
  - `rounded-control` (10px): inputs, buttons, chips
  - `rounded-card` (16px): cards
  - `rounded-sheet` (24px): dialogs and sheets
  - `rounded-full`: pills and avatars
- **Elevation:** cards use a border, not a shadow. `shadow-raised` is for floating cards and menus;
  `shadow-overlay` is for dialogs, sheets and toasts.

## Breakpoints

Tailwind defaults, mapped to the devices we test:

| Width | Device | Breakpoint |
|---|---|---|
| 375 / 390 / 430 | Phones | (base) |
| 768 | Tablet portrait | `md` |
| 1024 | Tablet landscape, small laptop | `lg` |
| 1280 / 1440 | Laptop, desktop | `xl` |

`PageContainer` widths:

| Width | Max | Use |
|---|---|---|
| `narrow` | 672px | Forms, reading |
| `default` | 1024px | Lists |
| `wide` | 1280px | Dashboards, tables |

## Components (`src/components/ui/`)

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (module deep), `tonal`, `secondary`, `ghost`, `danger`. Sizes `sm` 36, `md` 44, `lg` 48. `icon`, `loading` (spinner + blocked), `href` (renders a link), `tone` (module) |
| `IconButton` | Required `label` (accessible name); 44px; optional `dot` for unread |
| `Card` | White, 1px line, 16px radius; `padding`, `raised`, `as` |
| `ModuleCard` | App tile from `MODULES`; live → link in module fill, Coming soon → muted, labelled, not a link |
| `Input`, `Textarea`, `Select` | Label, `hint`, `error` built in; error sits under the field and is linked with `aria-describedby` |
| `Checkbox`, `Radio`, `RadioGroup` | Whole row is the target (44px) |
| `Badge` | `status` (success/warning/danger/info/neutral) or `tone` (module) |
| `Avatar` | Photo or initials |
| `Dialog`, `ConfirmDialog`, `BottomSheet` | Native `<dialog>`; `variant="sheet"` slides up on phones; `size` sm/md/lg |
| `ToastProvider`, `useToast` | `toast.show(message, 'success' \| 'error' \| 'info')`; errors stay until dismissed |
| `EmptyState` | Icon in module tint, title, one line, one action |
| `ErrorState`, `LoadError` | What went wrong and "Try again" |
| `Loading`, `Skeleton`, `SkeletonCard` | Prefer skeletons shaped like the content |
| `SectionHeading` | Title, optional description and action |
| `PageContainer` | Gutters and max width |
| `cn()` | Merges class names; later classes win |

### Interaction states

| State | Treatment |
|---|---|
| Hover | Slightly lighter fill (`/90`) or `sunken` background |
| Active | `/80` fill or `line` background |
| Focus | 3px terracotta-deep outline, 2px offset (global `:focus-visible`); fields add a soft ring |
| Disabled | 50% opacity, not clickable |
| Loading | Spinner, `aria-busy`, not clickable |
| Error | Danger border + message under the field, announced (`role="alert"`) |
| Success | Toast, or a success `Badge` |

Animations respect `prefers-reduced-motion`.

## App shell and navigation (Phase 2)

| Width | Navigation |
|---|---|
| Under 1024px (phones, tablets) | Top bar (logo, society, suggestions, notifications, account) + bottom tab bar |
| 1024px and up | Sidebar (`src/components/shell/SideNav.tsx`) + slim top bar; no bottom bar |

- `src/components/shell/AppShell.tsx` frames every page for approved residents. Signed-out, onboarding
  and pending screens keep the original centred card with no app navigation.
- `src/lib/design/navigation.ts` is the single navigation model for the bottom bar and the sidebar:
  - the bottom bar shows Home plus the current app's pages;
  - the sidebar lists every app, with the current app's pages underneath;
  - Admin appears only for society and app admins;
  - Coming soon apps are never links.
- **Full-width pages:** a page that uses `PageContainer` (which carries `data-full-width`) takes the
  whole content area. Pages not yet redesigned stay in a centred 640px column. The shell decides this in
  CSS (`:has()`), so it doesn't depend on the URL. That matters because reading the URL outside
  `<Suspense>` breaks prerendering.
- The active tab and sidebar item take the colour of the app you are in.

## Home (Phase 2)

`src/components/AppHubScreen.tsx` with sections in `src/components/home/`. Each section appears only
when it has real data (`homeSummary()` in `home-data.ts`):

1. Greeting
2. Latest society notice (highlighted)
3. Next confirmed ride
4. Things waiting on you (ride requests awaiting a reply; resident and class approvals for admins with those permissions)
5. Quick actions
6. Your apps (with real counts)
7. New in Classes
8. Older notices
9. Coming soon

Layout: phones one column; desktop a main column plus a 340px right rail.
