<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Club House Platform — AI Agent Guide & Architecture Blueprint

This document serves as the single source of truth for AI coding agents, autonomous contributors, and sibling applications (Community, Marketplace, Lessons/Classes, Review) interacting with the **Club House** ecosystem.

---

## 1. Product Ecosystem & Vision

**Club House** (formerly Junto, and before that Saath) is the parent app: a multi-tenant platform for gated residential apartment societies and communities. It eliminates commercial friction, high commission aggregator charges, and stranger safety risks by providing verified, closed-loop co-resident products.

Naming: users see **Club House** as the app and **RideShare** as a sub-app (`src/lib/brand.ts`). Internal identifiers such as the `junto_session` cookie, storage keys and the repository name keep the old name so sessions survive.

### Suite of Community Apps:
1. **RideShare (Active / V1 Pilot)**, a sub-app of Club House: Peer-to-peer co-resident carpooling to tech parks, offices, and metro hubs. Strict zero commercial fares, zero in-app payment rails. Optional fuel sharing calculations (mileage & distance points) handled in-person.
2. **Lessons / Classes (Active / V1)**: In-society classes (yoga, music, tuition, fitness, piano, coding, hobbies) organized and taught by verified resident teachers. Society admin approval workflow, flexible fee structures (free, per session, per month, per course), peer-to-peer outside settlements, schedule picker, and direct WhatsApp contact.
3. **Community (Next Phase)**: Resident directory, interest clubs, building discussions, and neighborhood circles (excluding society circulars).
4. **Marketplace (Next Phase)**: Secure peer-to-peer household buy, sell, and rent platform for verified neighbors.
5. **Review (Next Phase)**: Verified crowd-sourced resident reviews and contacts for domestic staff (maids, cooks, drivers, cleaners), nannies, and local home service vendors.

---

## 2. Security, Authentication & Isolation Rules

### 2.1 Multi-Tenant Isolation
- **Rule**: Every query, mutation, indexing key, or session context MUST be partitioned by `societyId`.
- A user registered or approved in Society A (e.g., `soc-ggh-001`) must never see rides, requests, marketplace items, or directories from Society B (e.g., `soc-pfr-002`).
- Storage keys follow the single-table isolation pattern: `${societyId}#${entityId}`.

### 2.2 Phone Authentication & Gated Onboarding
- **Identity Provider**: Firebase Phone Authentication with SMS OTP verification.
- **Strict Verification Gate**:
  - Entering mobile number checks if user exists and has an approved membership (`ACTIVE`).
  - If new user or profile incomplete: prompts for mandatory onboarding (Full Name, Tower & Flat Number, Email, Gender, Commute Intent).
  - Once submitted, status moves to `PENDING_APPROVAL`.
  - A screen stating **"Verification Pending — Your society admin needs to approve your resident profile before you can access apps"** blocks access to community apps until approved.
- **ZERO Developer Bypass in Production**: No hardcoded mock OTPs (`123456`), no demo bypass buttons, and no unvalidated session tokens.

### 2.3 Strict PII & Contact Disclosure
- Commuter phone numbers, precise flat numbers, and vehicle registration numbers are **strictly masked** (`+91 98*** **233`, `Flat Hidden`, `KA-04-**-****`).
- Full contact details are disclosed **only** after a ride match is explicitly accepted by both parties.
- Token exchange in URL parameters or unauthenticated query strings is strictly prohibited to prevent URL-sharing credential leakage.

---

## 3. Tech Stack & Infrastructure

- **Framework**: Next.js 16 (App Router, Turbopack, React 19).
- **Styling**: Tailwind CSS v4, Lucide React icons.
- **Database Engine**:
  - Cloud Production: Google Cloud Firestore (Standard/Enterprise). Credentials come from the `FIREBASE_SERVICE_ACCOUNT_KEY` (or `_B64`) environment variable in Amplify; never commit a service-account file. Production refuses to start without them.
  - Local/Testing: `MockDynamoRepository` (`src/lib/db/mock-repository.ts`) with deterministic in-memory indexing and tenant isolation.
  - Abstraction: `ISocietyRepository` interface (`src/lib/db/repository.interface.ts`).
- **Maps & Geocoding**:
  - OpenStreetMap (OSM) / Photon geocoding for cost-free address autocomplete with Bangalore tech park fallback dataset.
  - Google Places API with bounded bounds if configured.
- **Hosting & CI/CD**:
  - GitHub Repo: `https://github.com/dixitashutosh007/junto.git` (main branch).
  - AWS Amplify Hosting: App ID `d2dolgqm6zsfo9` (Region: `ap-south-1`, auto-building on push to `main`).
- **Testing**: Vitest (`npx vitest run`) with automated multi-tenant isolation, route detour, and security tests.

---

## 4. Role-Based Access Control (RBAC) & Audit Trails

### Roles:
- **`RESIDENT`**: Regular verified community member (Ride Offerer, Ride Seeker, Marketplace Buyer/Seller, etc.).
- **`SOCIETY_ADMIN`**: Society committee member managing a specific society. Has granular permissions configured:
  - `canApproveResidents`: Approve or reject new onboarding submissions.
  - `canManageSettings`: Update detour tolerances, society coordinates, and community rules.
  - `canModerateReports`: Review safety flags and user complaints.
  - `canViewAuditLogs`: View society activity trail.
- **`SUPER_ADMIN` / Platform App Admin**: Controls platform-wide RBAC, promotes/demotes society admins, manages granular permission flags across societies.

### Dynamic Navigation Menu:
- The UI navigation adapts dynamically according to active role:
  - **Admins** (society and app admins are residents too): see the menu for their ride mode below, plus `Admin`.
  - Every user picks a ride mode (Offer / Find / Both) from the top-bar Role menu, the home screen or their profile.
  - **Ride Offerers**: See `Home`, `Offer Ride`, `My Rides`, `Profile`.
  - **Ride Seekers**: See `Home`, `Find Ride`, `My Requests`, `Profile`.
  - **Both**: See `Home`, `Find Ride`, `Offer Ride`, `Profile`.
  - The menu follows the membership role and the user's commute preference, never a user ID.

### Audit Logging:
- All administrative lifecycle actions (approvals, rejections, suspensions, settings updates, RBAC role modifications) are logged via `recordAuditEvent()` and queryable via `/api/v1/admin/audit-logs`.

---

## 5. Peer-to-Peer Zero Payment Policy

- **Legal Compliance**: Club House is strictly a non-commercial community facilitation tool.
- **No In-App Payments**: The app does **not** process, hold, or escrow money. No payment gateway integration.
- **Fuel Points Estimation**: Fuel sharing or mileage estimates based on commute distance and car mileage are purely informational. Any shared expenses must be settled directly between neighbors in person.

---

## 6. Directory Structure & Key Files

```
├── AGENTS.md                               # This file — AI Agent Architecture & Guidelines
├── V1_TECHNICAL_BLUEPRINT.md               # Detailed database schemas, API specs, and algorithms
├── src/
│   ├── app/
│   │   ├── page.tsx                        # App Hub screen & main ride dashboard
│   │   ├── admin/page.tsx                  # Society Admin Portal (Members, Reports, Logs, RBAC)
│   │   ├── profile/page.tsx                # Resident profile & vehicle management
│   │   ├── rides/offer/page.tsx            # Offer a ride flow
│   │   ├── rides/find/page.tsx             # Find & match rides flow
│   │   └── api/v1/
│   │       ├── auth/session/route.ts       # Firebase ID token → signed session cookie
│   │       ├── auth/me/route.ts            # Profile & onboarding persistence
│   │       ├── admin/residents/route.ts    # Approve/Reject/Block resident endpoint
│   │       ├── admin/rbac/route.ts         # Granular RBAC permissions endpoint
│   │       ├── admin/audit-logs/route.ts   # Society audit trail endpoint
│   │       ├── rides/                      # Ride occurrence, match, and request APIs
│   │       └── moderation/reports/route.ts # Safety reporting and resolution
│   ├── components/
│   │   ├── AppHubScreen.tsx                # Multi-app selector (RideShare, Community, etc.)
│   │   ├── PhoneOtpModal.tsx               # Firebase Phone Auth & OTP modal
│   │   ├── ResidentOnboardingModal.tsx     # Mandatory resident profile details collection
│   │   ├── PlacesAutocompleteInput.tsx     # High-contrast OSM/Google places input
│   │   └── BottomNav.tsx                   # Persona-aware dynamic navigation
│   ├── context/
│   │   └── AuthContext.tsx                 # Client auth session & state management
│   ├── lib/
│   │   ├── db/
│   │   │   ├── firestore-repository.ts     # Google Cloud Firestore implementation
│   │   │   ├── mock-repository.ts          # In-memory test & dev repository
│   │   │   └── repository.interface.ts     # ISocietyRepository contract
│   │   └── api-auth.ts                     # API route session & token validator
│   └── types/
│       └── index.ts                        # Shared TypeScript models and interfaces
```

---

## 7. Instructions for Sibling App Agents

When creating or extending sibling apps (e.g., **Community**, **Marketplace**, **Lessons**, **Review**):
1. **Consume `useAuth()`**: Always rely on `AuthContext` for `society`, `user`, and `membership` status.
2. **Gate on `membership.status === 'ACTIVE'`**: Never render interactive features to users whose status is `PENDING_APPROVAL` or unverified.
3. **Persist within `ISocietyRepository`**: Add new domain methods to the repository interface and implement both mock and Firestore stores with `${societyId}` partitioning.
4. **Run Verification**: `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` must all pass.
5. **Ship through a pull request**: CI runs the same checks on every PR. Merging to `main` deploys to production through AWS Amplify, so never push straight to `main`.
6. **Follow the project rules in section 8.**

---

## 8. Project Rules (enforced)

Club House is the parent app for a housing society; RideShare, its first sub-app, lets residents share rides. Read `docs/PRODUCTION_ROADMAP.md` for the current hardening plan; some rules below describe the target state that the roadmap phases are moving the code towards.

**Stack:** Next.js 16 App Router, React 19, Firebase Phone Auth + Firestore (admin SDK, server-only), Zod 4, Tailwind 4, Vitest. Deployed on AWS Amplify (`amplify.yml`).

**Commands** (all must pass before committing; CI runs them on every PR):
- `npm ci --legacy-peer-deps`
- `npm run typecheck`
- `npm test`
- `npm run lint` (zero warnings allowed)
- `npm run build`

**Frontend conventions:**
- Call the API with `apiFetch` from `src/lib/api-client.ts` (never hand-build `x-dev-user-id` / `x-society-id` headers); load data with `useApiData`.
- Read the current date or browser-only APIs during render via `useIsClient`, not by copying them into state in an effect.
- Use `Dialog` / `ConfirmDialog` from `src/components/ui/Dialog.tsx` (never `window.confirm`), and `Loading` / `LoadError` for load states.
- Every form control needs a label; icon-only buttons and links need `aria-label`; text must meet WCAG AA contrast (no `*-400` grey text).

**Layout:**
- API routes: `src/app/api/v1/**/route.ts`
- Auth for routes: `src/lib/api-auth.ts` (`requireAuth`); sessions: `src/lib/auth/session.ts`
- Data access only through `getRepository()` (`src/lib/db`); `FirestoreRepository` in production, `MockDynamoRepository` (seeded demo data) in development and tests
- Shared types: `src/types`; request schemas: `src/lib/validation/schemas.ts`
- Route tests: `src/app/api/**/__tests__/*.test.ts`, using `makeRequest` and `resetRepository` from `src/test/route-helpers.ts`; mock Firebase with `src/test/firebase-admin-mock.ts` to test production auth

**Every API route must:**
- Start with `const auth = await requireAuth(req, { statuses?, roles? }); if (auth instanceof NextResponse) return auth;`. It returns 401 when signed out and 403 unless the membership is `ACTIVE` (pass `ONBOARDING_STATUSES` only for onboarding routes).
- Validate the body and query with a Zod schema via `parseBody(req, Schema)` / `parseQuery(req, Schema)` from `src/lib/validation/parse.ts`; never destructure raw `req.json()`.
- Check ownership or role on the target entity (the offerer, the seeker, or an admin of *that* society).
- Admin routes pass `permission: 'canApproveResidents' | 'canManageSettings' | 'canModerateReports' | 'canViewAuditLogs'` to `requireAuth`.
- Return generic error messages (`serverError(context, err)`); never echo `err.message` to the client.
- Have a route test covering the unauthorized and wrong-user cases.

**Security invariants:**
- The server uses the Firestore admin SDK, which bypasses `firestore.rules`; the rules deny all direct client access. The API is the only access-control boundary.
- Dev shortcuts (`x-dev-user-id`, the persona switcher, `dev-token-*` tokens, OTP `123456`, `MockDynamoRepository`) must be unreachable when `NODE_ENV === 'production'`.
- Contact data (mobile, flat number, number plate) is shown only to accepted ride participants, via `formatPublicJourneyView` in `src/lib/services/privacy.ts`.
- Never hardcode a society ID; use `auth.societyId`.
- Never commit secrets; service-account keys stay in Amplify environment variables and never use the `NEXT_PUBLIC_` prefix.

**Data conventions:**
- Seat counts change only through `acceptRideRequest` / `closeRideRequest` / `cancelRideWithRequests`, which apply the rules in `src/lib/services/seat-booking.ts` atomically.
- Times are Asia/Kolkata: use `src/lib/utils/time.ts` (`istDateTime`, `istDateString`, `formatIstTime`); never `toISOString().split('T')[0]` or `toLocaleTimeString` without a time zone.
- IDs come from `crypto.randomUUID()`, not `Date.now()`.
- No placeholder data (flat numbers, distances, coordinates) in production responses; fail or mark the value as unknown.
