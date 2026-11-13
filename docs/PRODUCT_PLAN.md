# Club House product plan

Living priority list. Phases 1–3 (dependable RideShare; privacy and compliance; classes and
community) shipped in PRs #12–#14. Items are worked top to bottom.

**Status:** priorities 1–4 below are done (PR after #14). Next up is "Later".

## Priority 1: bugs and governance (owner feedback, 13 Nov 2026)

| # | Item | Notes |
|---|------|-------|
| 7 | Signed-in users briefly see "register for society" | Flash before the session check finishes |
| 13 | Suggestions tile in "At a glance" opens the wrong page | Should open the suggestions inbox |
| 8 | Notices: add **From**; tapping a notification shows its full text | Detail view for notifications and notices |
| 9 | Admin **Residents** list: view, edit records, suspend, block | Per resident |
| 10 | **Society details** with its admins; add many admins and revoke them | Societies list → details |
| 12 | At a glance: rides this week and classes open a simple list | Governance view |
| 14 | One **Settings** page for society and every app (RideShare, Classes, later more) | Replaces two pages |
| 11 | Remove **Download my data** | Privacy Policy updated: ask the society admin |

## Priority 2: RideShare and Classes

| # | Item | Notes |
|---|------|-------|
| 2 | **End trip** for both offerer and rider, so a finished ride stops showing | |
| 3 | **Reputation** for offerers and riders | From ratings after rides |
| 4 | **Ride history**: past rides offered and taken | |
| 5 | **Hide a resident**: their rides and requests stop showing to each other | Also needed for app store review |
| 1 | "Call Trainer" → **"Call Coach / Tutor"** | |

## Priority 3: simplicity

| # | Item | Notes |
|---|------|-------|
| 6 | Simpler, minimal screens inside each app: icons, less text, no duplicate buttons or menus | RideShare and Classes first |
| 15 | Suggestion box revamp: available wherever residents need it, one inbox for admins | |

## Priority 4: mobile apps groundwork (server side)

Needed before wrapping the app for the App Store and Play Store (Capacitor), estimated 3–5 weeks in total.

- Done: `Authorization: Bearer` tokens as well as the session cookie, CORS for the app origins
- Done: push devices with a platform (web / iOS / Android); apps get visible notifications
- Done: deep-link files for invite links (served once the app IDs are set)
- Still to do with the apps themselves: store paperwork (privacy labels, Data safety, a test
  login for reviewers). See `docs/MOBILE_APPS.md`.

## Later: phase plan (13 Nov 2026)

Each phase ships as one pull request and is merged only when the owner says so. Estimates are
working time; phases 7 and later depend on owner decisions listed under each.

### Phase 5: polish and quality (about 1 week)

| Item | What it means |
|---|---|
| Loading placeholders | Grey placeholder cards instead of "Loading…" text on every list |
| Install prompt | "Add Club House to your home screen" once, after a resident's second visit |
| Vehicle fuel type | Petrol, diesel, CNG or EV on each car; fuel share uses the right price (EV: per kWh) |
| Browser tests in CI | Sign-in, offer, request, accept, end trip and admin approval run in a real browser on every PR, with an accessibility check |

### Phase 6: Hindi and Kannada (about 1–1.5 weeks)

- One translation file per language; every screen reads its text from it
- Language choice in Profile, defaulting to the phone's language
- Push notifications and notices go out in each resident's language
- **Owner decision:** a native speaker from a society checks the wording before release

### Phase 7: iOS and Android apps (about 3–5 weeks)

Server side is ready (see `docs/MOBILE_APPS.md`).

- Wrap the app with Capacitor; native sign-in, secure token storage, native push, invite links
- App icons, splash screen, store screenshots and descriptions
- App Store privacy labels, Play Data safety form, reviewer test phone number
- Beta through TestFlight and Play internal testing, then release
- **Owner decisions:** Apple Developer account (US$99 a year) and Google Play account
  (US$25 once) in the owner's name; app name and bundle ID (e.g. `in.clubhouse.app`)

### Phase 8: Community app (about 2–3 weeks)

- Resident directory, opt-in only: name, tower and interests, never mobile or flat number
- Interest clubs (walking, cricket, book club…) residents create and join
- Discussions per club and per building, with report, hide and admin moderation
- **Owner decision:** whether the directory is on by default per society or each admin turns it on

### Phase 9: Marketplace (about 2–3 weeks)

- Sell, give away, rent or lend household items to neighbours, with photos
- "I'm interested" shares contact only with the seller, as in Classes
- Mark sold, auto-expire after 30 days, report and admin moderation
- No payments in the app, as with rides: settled between neighbours
- **Owner decision:** which categories are allowed (e.g. no vehicles or property at first)

### Phase 10: Reviews (about 2 weeks)

- Directory of domestic staff and local services (cooks, drivers, plumbers, tutors)
- Only residents who used them can review; one review per resident, editable
- Staff mobile numbers shown only to residents of that society
- Admins can remove unfair reviews; the person reviewed can ask for removal
- **Owner decision:** wording of the review guidelines (legal care around defamation)

### Order and timing

Phases 5 and 6 can ship within about 2–3 weeks. Phase 7 can start any time after the
developer accounts exist and can run alongside 8–10.
