# Club House product plan

Living priority list. Phases 1–3 (dependable RideShare; privacy and compliance; classes and
community) shipped in PRs #12–#14. Items are worked top to bottom.

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

- Accept `Authorization: Bearer` tokens as well as the session cookie
- Push devices with a platform (web / iOS / Android) and visible notifications for iOS
- Deep-link files for invite links (Apple app-site-association, Android asset links)
- Store paperwork: privacy labels, Data safety, a test login for reviewers

## Later

- Phase 4 polish: loading placeholders everywhere, Hindi and Kannada, install prompt, browser tests in CI
- Phase 5: Community, Marketplace and Reviews apps
- Vehicle fuel type (petrol, diesel, CNG, EV) for fairer fuel estimates
