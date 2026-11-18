# Club House: handover for the next agent

Last updated: 16 Nov 2026. `main` is at `e6f7b11` (PR #21, Circle Stage 1), deployed by AWS Amplify.

Read this file first, then `AGENTS.md`, which holds the project rules every change must follow. This file
records what has been built, how the owner likes to work, and what is still to do.

---

## 1. How the owner works (follow this exactly)

1. **Inspect → plan → wait for approval → build → check → report → stop.** Never start the next
   stage or phase without the owner's go-ahead.
2. **Ask before deciding.** For a new feature, ask clarifying questions first. Do not silently change
   API contracts, Firestore data shapes, permissions or business rules; propose and wait.
3. **Commit, push and merge only when asked** ("commit and merge", "merge to main"). Merging to `main`
   deploys to production, so always go through a pull request, wait for CI (`checks`) to pass, then merge.
4. **Never** reset, clean, stash or discard the owner's uncommitted work without permission.
5. **No new dependencies** without approval.
6. **Never weaken security**, never show one society's data to another, never invent user data, and never
   add ride fares or payments (Club House handles no money).
7. **Completion report format** (used at the end of every stage): what residents get, what admins get, checks
   run and their results, problems found and fixed, decisions for the owner to confirm, what could not be
   verified here, and what is next. Plain language; the owner is not a developer.

---

## 2. The product today

**Club House** is a multi-society app for gated housing societies (India, Asia/Kolkata time). Residents sign
in with their phone (Firebase SMS OTP), join their society, and a society admin approves them before they can
use any app.

| App | Status | Where |
|---|---|---|
| RideShare | Live | `/rides`, `src/app/rides` |
| Classes | Live | `/lessons`, `src/app/lessons` |
| **Circle** (replaces "Community") | **Live, Stage 1 of 3** | `/circles`, `src/app/circles` |
| Home Chef, Marketplace, Recommendations | Coming soon tiles only | `src/lib/design/modules.ts` |

Stack: Next.js 16 App Router (Turbopack, `cacheComponents`), React 19, Tailwind 4, Zod 4, Vitest, Firebase Auth +
Firestore (admin SDK, server only), AWS Amplify (app `d2dolgqm6zsfo9`, `ap-south-1`). The GitHub repo is
`dixitashutosh007/junto`; GitHub now shows it as `dixitashutosh007/ClubHouse`.

### Commands (all must pass before any commit; CI runs the same)

```
npm ci --legacy-peer-deps
npm run typecheck
npm test            # 302 tests at handover
npm run lint        # zero warnings allowed
npm run build
npm run test:e2e    # browser + accessibility tests (Playwright); starts its own dev server
```

Formatting: single quotes. Never run plain `npx prettier`; use
`npx prettier --single-quote --print-width 140 --trailing-comma es5 --write <files>`.

### Local testing

- `npm run dev` uses `MockDynamoRepository` with seeded demo data (in memory; restarts reset it).
- Dev-only shortcuts, all unreachable in production:
  - Switch persona: browser localStorage `junto_dev_persona` set to a user ID.
  - Call the API directly: headers `x-dev-user-id: <id>` and `x-society-id: soc-ggh-001`.
  - OTP `123456`.
- Demo users in society `soc-ggh-001` (Mahaveer Ranches):

  | ID | Who |
  |---|---|
  | `usr-app-admin-001` | Rajesh, SUPER_ADMIN |
  | `usr-admin-001` | Vikram, SOCIETY_ADMIN |
  | `usr-offerer-001` | Ashutosh, resident, male |
  | `usr-seeker-001` | Priya, resident, female |
  | `usr-offerer-002` | Rohan, male |
  | `usr-offerer-003` | Ananya, female |
  | `usr-pending-001` | Rahul, pending |
  | `usr-pending-002` | Sneha, pending |

  A second society, `soc-pfr-002` (code PFR2024), has no members and is used for isolation tests.
- Other localStorage keys: `junto_logged_out='true'` signs out; `clubhouse_tour_seen='1'` skips the tour.
- Playwright and Chromium were used for browser checks and the axe accessibility sweep, run at widths
  375, 390, 430, 768, 1024, 1280 and 1440. The `@axe-core/playwright` package is a dev dependency.

---

## 3. Everything built so far (by pull request)

| PR | What |
|---|---|
| #1 | Production hardening, phases 0–4 (see below) |
| #2–#6 | Profile save fix; admins can also ride; changeable trips; 5-minute times; SMS error messages; society search and invite links; sign out; rename to Club House (RideShare as a sub-app); share trip, SOS, auto-suspend; backups runbook |
| #7 | Classes app: admin approval, WhatsApp contact, fee types, subjects. Society Configuration; RideShare live updates and wording; new Home |
| #8–#9 | Amplify deploy notes; Turbopack build fix for unstyled production pages |
| #10 | Module-aware navigation, top bar, editing classes, fee fix |
| #11 | Society onboarding wizard, choosing a society at sign-in, minimal Home |
| #12 | Start, complete and auto-expire rides; repeat rides; shared rate limits; FCM push; RideShare dashboard; readable activity log; admin menu; structured flat numbers |
| #13 | Privacy policy and terms; leaving a society; deleting an account and downloading your data; SOS log and admin alert; profile photos |
| #14 | Class "I'm interested" and Call trainer; society notices; admin overview numbers; waiting-approval screen; first-time tour; favicon |
| #15 | Owner feedback, priorities 1–4: governance, end trip, reputation, ride history, hiding a resident, simpler screens, suggestion box, server groundwork for phone apps (`docs/MOBILE_APPS.md`) |
| #16 | Fixes from the user-testing report; simpler RideShare and Classes |
| #17 | **Aangan redesign**, phases 1–3: design system (`docs/DESIGN_SYSTEM.md`, `src/components/ui`), resident Home and navigation, RideShare and Classes |
| #18 | Redesign phases 4–5: profile, onboarding, notifications; admin experience |
| #19 | Redesign phase 6: QA fixes (keyboard, focus, skip link, `useModalFocus`, contrast, responsive) |
| #20 | Open items: icons, dependency advisories cleared, editing notices, server-paged residents list, faster sign-in (LCP 2.9 s → 0.93 s) |
| **#21** | **Circle Stage 1** (section 4) |

**Hardening, roadmap phases 0–4** (`docs/PRODUCTION_ROADMAP.md`):
- Signed session cookies and a central `requireAuth`.
- Zod validation on every route.
- Ownership checks, and no data crossing between societies.
- India-time handling and atomic seat booking.
- No hardcoded society.
- Route tests for all of the above.

---

## 4. Circle: the requirements the owner agreed

Circle is a society group (sport, hobby and so on) with a WhatsApp link. These are the owner's decisions:

1. Circle replaces the Community tile and is Live. Its colour is **Neel indigo**: deep `#33508f`, tint `#e6ecf7`,
   fill `#4a68ad`. Tabs: Circles · Create · My circles.
2. Types and sub-types are editable in Society Settings. The seed list:
   - Sports: Cricket, Football, Chess, Games, Basketball, Snooker, Table Tennis, Badminton, Squash,
     Tennis Ball Cricket, Box Cricket
   - Yoga, Community, Dance, Music, Party, Other (no sub-types)

   "Other" lets residents type their own sub-type. A deleted type keeps its label on existing circles.
3. No member limit. Each resident can start up to 5 circles (live or waiting), and the limit is editable in Settings.
4. Before joining, people see only the member count. After approval they see member **names only**, plus the
   **owner's and co-admins' names and phone numbers**, the WhatsApp link and the other link.
5. Joining is "Approval needed" by default, or "Open" (join at once). A declined person can ask again after
   **3 days**, and the decline note is optional. Members can leave. Removed people can ask again; nobody is blocked.
6. Co-admins have the same powers as the owner, except that only the owner manages co-admins, transfers
   ownership and closes the circle.
7. If the owner leaves the society, ownership goes to the longest-serving co-admin; with none, society admins
   are notified and choose a new owner. The owner can also hand over first.
8. Society admins have full control and every action is logged. **Any society admin** approves circles; there
   is no separate permission.
9. Edits to the name, description or links of a live circle need re-approval. The **old version stays live until
   approved**, and the editor is told the outcome.
10. Circles can be reported through Safety reports. Search, type filters and My circles are included.

### Stage 1 (done, PR #21)

- **Data:**
  - Types `Circle`, `CircleMember`, `CircleType` and friends in `src/types/index.ts`.
  - Repository methods in `repository.interface.ts`, with mock and Firestore implementations.
  - Firestore paths: `societies/{id}/circles/{circleId}` and `societies/{id}/circle_members/{circleId}__{userId}`.
    Only single-field queries are used, so no composite index is needed.
- **Rules:**
  - `src/lib/circle-types.ts`: defaults, limit, 3-day wait.
  - `src/lib/services/circles.ts`:
    - `circleAccess` and `circleView`, which decide what each viewer may see. This is the privacy boundary.
    - `notifyCircle`.
    - `leaveAllCircles`, called from `leaveSociety` in `src/lib/services/account.ts`, which covers moving out,
      removal by an admin and account deletion.
- **API:**
  - `src/app/api/v1/circles/route.ts`:
    - GET: browse, `?id=`, `view=mine`, and `view=pending` / `view=all` for admins.
    - POST: create. PUT: edit (pending change).
    - PATCH: APPROVE, REJECT, APPROVE_CHANGE, REJECT_CHANGE, CLOSE.
  - `src/app/api/v1/circles/members/route.ts`:
    - GET: requests and members, for circle admins.
    - POST: join. DELETE: leave or withdraw.
    - PATCH: APPROVE, REJECT, REMOVE, MAKE_CO_ADMIN, REMOVE_CO_ADMIN, TRANSFER_OWNERSHIP.
  - Schemas in `src/lib/validation/schemas.ts` (Circle section). WhatsApp links must be
    `https://chat.whatsapp.com/...`.
  - Settings accept `circleTypes` and `maxCirclesPerResident`.
  - Reports accept `circleId`; the report must name the circle's owner.
- **Pages:**
  - `/circles` (browse), `/circles/create`, `/circles/edit/[id]`, `/circles/[id]` (details, join, the
    members' section and the manage panel), `/circles/mine` (Joined / Running / Requests).
  - Shared pieces in `src/app/circles/_components`.
- **Admin:**
  - Circles section under Governance (`src/app/admin/_components/CirclesTab.tsx`): approvals, changes shown
    as before and after, circles without an owner, all circles.
  - A waiting-count badge, and overview tiles "Circles waiting" and "Live circles".
  - Settings → Circles (`CircleTypesEditor.tsx`): types, sub-types and the limit.
  - Circle reports in Safety reports.
- **Other:**
  - Home has "Find a circle" and "Create a circle" shortcuts, and the Circle tile shows the live count.
  - The notification bell has a `CIRCLE` icon.
  - Activity log text for `CIRCLE_*` actions.
- **Tests:** `src/app/api/v1/circles/__tests__/circles.test.ts` (16 tests) covers:
  - signed-out access, input checks, the limit, privacy
  - approve and decline, the 3-day wait, Open circles, the women-only rule
  - leave, remove, co-admins, transfer
  - pending edits, close
  - society isolation, the owner handover on leaving, reports, settings
- **Checked:** browser flows end to end; the axe sweep is clean at all 7 widths; API access is correct for
  pending, outsider, member and admin.

**Owner decisions (confirmed 17 Nov 2026), all built:**
1. There is no cap on how many circles a resident can ask to join.
2. A circle report is about both the circle and its owner. The server finds the owner from `circleId`, so the
   screens never receive the owner's ID. Safety reports shows the circle's name.
3. Approved members see the owner's and co-admins' names and numbers.
4. Society admins' own circles go live at once, with no limit.
5. Society admins who haven't joined don't see inside a circle: no links, member list or numbers, and no messages.
   They keep full control through the manage panel and Admin → Circles, and see a new circle's links only while
   approving it.
6. A closed circle stays readable for its members, then is archived 60 days after closing. Archived circles are
   hidden from members (gone from My circles, and messages are closed) and remain visible to society admins.
   This is computed from `closedAt`; there is no scheduled job.
7. A message deleted by someone else disappears for others within about a minute.
8. Unread counts stop at 99+.
9. Riders also see a banner for their own requests still awaiting a reply.
10. At most 12 banners appear at once.
11. Notices stay until they expire or are dismissed.

---

## 5. What is pending

### 5.1 Circle Stage 2: messages (built 17 Nov 2026; not yet merged unless a later PR says so)

Built to the agreed rules:
- Only approved members can read and post; society admins who aren't members can't.
- Text only, at most 150 words, emoji refused, links tappable.
- New messages arrive within about 15 s by polling, with unread counts. There is no push per message.
- Authors delete their own messages; owners and co-admins delete any, and that is logged without the text.
  No editing and no reporting.
- 30 days of history, tidied as new messages arrive.
- One message per 10 s per resident.
- Removed or declined people lose access on the next request.

Where it lives:
- Rules: `src/lib/validation/circle-message.ts`.
- API: `src/app/api/v1/circles/messages/route.ts` (GET with `after`, POST, DELETE) and `.../messages/unread/route.ts`.
- Storage: messages in Firestore `societies/{id}/circles/{circleId}/messages/{messageId}`, with
  `CircleMember.lastReadAt` for unread counts.
- Page: `src/app/circles/[id]/messages/page.tsx`. Unread counts come from `src/hooks/useCircleUnread.ts` and show on the
  circle page (a Messages button), on My circles cards and on the Home Circle tile.
- Accounts: deleting an account deletes the resident's messages, and "Download my data" includes them.
- Tests: `src/app/api/v1/circles/__tests__/messages.test.ts` (11 tests).

### 5.2 Circle Stage 3: Home banner row (built 17 Nov 2026, together with Stage 2)

One swipeable row of "Updates" at the top of Home: arrows on larger screens, nothing moves on its own. Each banner
has ✕, and a dismissal is stored on the server, so it applies on every device.

- **Banners, in order:**
  - Your seat is confirmed.
  - Seat requests to answer (offerer).
  - Your ride requests awaiting a reply (rider).
  - Approvals waiting: residents, classes and circles, each shown only with the matching admin permission.
  - You're in a circle.
  - Society notices; tapping one opens it.
  - New circle (first 3 days).
  - New class (first 3 days).
- **Count banners come back when something new arrives:** their id includes the newest item.
- **Dismissed notices move to "Earlier notices"** on Home, so they can still be read.
- **This replaced** the old featured notice card, the "needs your attention" rows, and the one-device (localStorage)
  notice dismissal.

Where it lives:
- Builder: `src/lib/services/home-banners.ts`.
- API: `src/app/api/v1/home/banners/route.ts` (GET; DELETE `?id=` to dismiss).
- Storage: dismissals in Firestore `societies/{id}/banner_dismissals/{userId}`.
- Screen: `src/components/home/HomeBanners.tsx`, wired up in `src/components/AppHubScreen.tsx`.
- `Circle.approvedAt` is new, used for "new circle".
- Tests: `src/app/api/v1/home/__tests__/banners.test.ts`.

**Stages 2 and 3 still need merging and then the owner's live test.** All Circle stages are then complete.

### 5.3 Polish and quality (approved 17 Nov 2026; Hindi and Kannada skipped by the owner)

1. **Browser tests in CI: built.**
   - `e2e/` has 32 Playwright tests, run by the CI job `browser-tests`:
     - sign-in with the test code
     - offer → request → accept → seat confirmed
     - admin approvals of a resident, a class and a circle
     - Circle: create, join from a card, approve, message (emoji refused), and an admin who isn't a member
     - axe accessibility checks on 14 main pages, at phone and desktop sizes
   - Starting and ending a trip depend on departure time, so the route tests cover those, not the browser tests.
   - Fixing the accessibility findings changed the logo link, the account menu label, the Offer day chips, the
     Classes "View details" labels, and drew avatar initials with CSS.
2. **Fuel type on vehicles: next.**
   - Each vehicle gets Petrol, Diesel, CNG or Electric, with km/L, km/kg or km/kWh.
   - Society Settings gets four prices: petrol ₹103/L, diesel ₹90/L, CNG ₹89/kg and electric ₹9/kWh.
3. **"Add to home screen" prompt: after that.**
   - It shows from the second visit, as an Android install button or iPhone steps.
   - ✕ is remembered on that phone.

### 5.4 Other pending work (from `docs/PRODUCT_PLAN.md` and `docs/PRODUCTION_ROADMAP.md`)

- **Owner actions in production:**
  - Turn on Firestore backups (`docs/OPERATIONS.md`).
  - Replace the cloud deploy key with a deploy-only account (`docs/RELEASE_CHECKLIST.md`).
  - Restrict the Google Maps key if one is used.
  - Optional SMS region policy and App Check.
- **Roadmap 5.1:** error monitoring, structured logging, uptime check.
- **Roadmap 5.5:** admin view of repeat ride cancellers.
- **Roadmap 5.7:** staging environment and a 2-week pilot.
- **Product plan phase 5:**
  - Install prompt.
  - Vehicle fuel type (petrol, diesel, CNG or EV) in fuel-share estimates.
  - Browser tests in CI (sign-in, offer, request, accept, end trip, admin approval, with axe).
- **Phase 6:** Hindi and Kannada. A native speaker must check the wording.
- **Phase 7:** iOS and Android apps with Capacitor. The server side is ready (`docs/MOBILE_APPS.md`); the owner
  needs Apple and Google developer accounts.
- **Phase 8 (Community):** largely replaced by Circle. An opt-in resident directory and building discussions
  are not built; ask the owner whether they are still wanted.
- **Phase 9 (Marketplace)** and **phase 10 (Reviews):** not started. Each has an owner decision listed in the plan.
- **Not verifiable in the cloud sandbox:** real SMS, real push delivery, PWA install, and Firestore `getAll`
  batching under production load. Check these on the live site.

---

## 6. Where things are

- **Rules:** `AGENTS.md` (`CLAUDE.md` just includes it).
- **Design:** `docs/DESIGN_SYSTEM.md`, tokens in `src/app/globals.css`, components in `src/components/ui`.
- **App list and colours:** `src/lib/design/modules.ts`.
- **Navigation:** `src/lib/design/navigation.ts` and `admin-navigation.ts`, both with tests.
- **Data loading and API calls:**
  - `useApiData(path | null, select, errorMessage, cacheKey)` in `src/hooks/useApiData.ts`.
  - `apiFetch` and `apiErrorMessage` in `src/lib/api-client.ts`.
  - Never hand-build dev headers.
- **Dialogs:** `Dialog` / `ConfirmDialog` / `BottomSheet`; `useModalFocus` for custom overlays; `useToast` for messages.
- **Auth:** `requireAuth` in `src/lib/api-auth.ts`; sessions in `src/lib/auth/session.ts`.
- **Contact privacy for rides:** `formatPublicJourneyView` in `src/lib/services/privacy.ts`.
- **Time:** `src/lib/utils/time.ts` (IST helpers only).
- **Route test helpers:** `makeRequest` and `resetRepository` in `src/test/route-helpers.ts`; Firebase mock in
  `src/test/firebase-admin-mock.ts`. Stub `NODE_ENV=production` to test signed-out (401) cases.
- **Operations:** `docs/OPERATIONS.md`, `docs/RELEASE_CHECKLIST.md`, `amplify.yml`, `firestore.rules`
  (denies all client access; the API is the only gate), `firestore.indexes.json`.
