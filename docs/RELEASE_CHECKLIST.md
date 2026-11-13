# Release checklist — production hardening (PR #1)

Handoff for whoever (person or AI session) continues this release. Read this first, then
`docs/PRODUCTION_ROADMAP.md` (what was built, per phase) and `AGENTS.md` (project rules).

- **Pull request:** https://github.com/dixitashutosh007/junto/pull/1 — branch `claude/epic-franklin-lmezo1` → `main`
- **Merging deploys to production:** AWS Amplify (app `d2dolgqm6zsfo9`, `ap-south-1`) builds `main` automatically.
- **Firebase project:** `saath-societyapps`
- **Previous working session (full history):** `session_01BSRaeMn8R9thdxYF9q23Lu`

## Status (as of 2026-10-09)

| Item | State |
|------|-------|
| Roadmap phases 0–4 | Done, all on the PR branch |
| CI on the PR (typecheck, tests, lint, build) | Green; no merge conflicts with `main` |
| Firestore rules (`firestore.rules`, deny all client access) | Verified 2026-10-09: live rules match the repo |
| Index: `audit_events` (`societyId` ↑, `createdAt` ↓) | Verified READY 2026-10-09 (an older ascending one also exists; harmless) |
| Field override: `members.userId`, collection-group ascending | Verified READY 2026-10-09 |
| Amplify `FIREBASE_SERVICE_ACCOUNT_KEY` / `_B64` set | Verified 2026-10-09: app-level, valid JSON, no branch overrides |
| First App Admin granted (`npm run grant-app-admin`) | Not yet done — nobody can approve residents until this is done |
| Real SMS login on an Amplify preview of this branch | Not yet done |
| Merge | Not yet |
| Ride-time migration (`npm run migrate:ride-times`) | Run after merge |

## Next steps, in order

1. **Verify Firebase config** against the repo files.
   A service-account key with *Firebase Rules Admin*, *Cloud Datastore Index Admin* and
   *Service Usage Consumer* is provided to cloud sessions as `GCP_DEPLOY_KEY_B64` (base64 JSON).
   Note: as of 2026-10-09 this key is the Firebase Admin SDK account (the same key as
   Amplify's), so it *can* read resident data; replace it with a deploy-only account.
   Use it only to:
   - read the deployed rules and indexes and compare them with `firestore.rules` /
     `firestore.indexes.json`;
   - deploy those files (`firebase deploy --only firestore:rules` / `firestore:indexes`)
     **only after showing the owner the difference and getting a yes**; never delete indexes.
   Both indexes must show **READY / Enabled** before merging, or sign-in and the audit log fail.
2. **Amplify:** confirm `FIREBASE_SERVICE_ACCOUNT_KEY` (or `_B64`) exists; production refuses
   to start without it.
3. **Grant the first App Admin.** The app never grants `SUPER_ADMIN` itself, and the old app
   created every phone sign-in as a pending resident, so until this is done every account
   (the owner's too) sees "Verification Pending". After signing in once with the phone, run
   from the repo root in Google Cloud Shell (logged in as the project owner):
   `npm ci && npm run grant-app-admin -- --phone <mobile>` (dry run), then add `--apply`.
   Pass `--society <id>` if asked. The change is written to the audit log.
4. **Preview test:** deploy the branch as an Amplify branch preview, add its domain to
   Firebase Auth → Authorized domains, then test SMS login, offering a ride at 08:30 (must
   show 08:30), and the browser console for Content-Security-Policy errors.
5. **Merge** PR #1. Everyone is signed out once (cookie changed).
6. **Migrate old ride times:** `npm run migrate:ride-times` (dry run), then `-- --apply`.
7. Optional: SMS region policy (India only), Google Maps API quotas and key restrictions,
   App Check (`NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`, enforce only after testing login).

## Deploying (Amplify)

Merging to `main` deploys only while Amplify is connected to the repository. The repository
was renamed from `junto` to `ClubHouse` after 2026-10-09, and Amplify stopped building `main`:
the pushes of 2026-10-26 and 2026-11-12 never deployed. Reconnected on 2026-11-12.

If a merge does not show up as a new build within a few minutes:

1. Amplify console → app `d2dolgqm6zsfo9` (ap-south-1) → `main` → **Run build** to deploy now,
   and check the build lists the merge commit.
2. **App settings → General → Reconnect repository**: `dixitashutosh007/ClubHouse`, branch `main`.
   If GitHub asks, let the AWS Amplify GitHub App access the repository.
3. **Branch settings:** `main` has **Auto build** on.
4. **Environment variables:** `FIREBASE_SERVICE_ACCOUNT_KEY` (or `_B64`) is still set.

After a release that adds society settings, the society admin fills in **Admin → Config**
(emergency number, pick-up points, class types and locations).

## Decisions already made

- Sessions are Firebase session cookies (`junto_session`, 14 days); dev shortcuts are
  development-only.
- Firestore is server-only (Admin SDK); client rules deny everything.
- CSP is static (no nonces) because nonces disable partial prerendering.
- Rate limits are shared across server instances (Firestore `rate_limits`, optional TTL on `expireAt`); Google Cloud quotas remain the real cost cap.
- Email is stored as unverified contact info; email verification links are Phase 5.
- Never push straight to `main`; ship through PRs with CI green.

## After release: Phase 5

Monitoring (e.g. Sentry), secrets review, Firestore backups, DPDP compliance (privacy policy,
consent, account deletion), safety features (share trip / SOS), real push notifications, pilot.
Several items need owner decisions (monitoring vendor, privacy policy wording).
