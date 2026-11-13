# Club House phone apps: what the server already supports

The iOS and Android apps will wrap the web app with Capacitor. The server side is ready:

## Signing in

1. The app signs in with Firebase phone auth as the website does and gets an ID token.
2. It calls `POST /api/v1/auth/session` with `{ "idToken": "…", "returnToken": true }`.
   The response includes `sessionToken` (valid 14 days, `expiresIn` in seconds).
3. Every API call sends `Authorization: Bearer <sessionToken>`, plus `x-society-id` for
   residents of several societies.
4. Signing out: `DELETE /api/v1/auth/session` with the same header revokes the session.

Store the token in the platform's secure storage (Keychain / Android Keystore), never in
plain preferences.

## CORS

`src/proxy.ts` allows API calls from `capacitor://localhost` (iOS) and `https://localhost`
(Android) only. Cookies are never allowed cross-origin.

## Push notifications

Register the device's FCM token with `POST /api/v1/notifications/devices`
`{ "token": "…", "platform": "ios" | "android" }`. Phone apps get a visible notification;
its `data.url` is the screen to open when it is tapped. Browsers keep data-only messages.

## Invite links

Set these in Amplify once the apps exist, so `/join/…` links open the app:

| Variable | Example | From |
|---|---|---|
| `APPLE_APP_ID` | `ABCDE12345.in.clubhouse.app` | Apple Team ID + bundle ID |
| `ANDROID_PACKAGE` | `in.clubhouse.app` | The app's package name |
| `ANDROID_SHA256_FINGERPRINTS` | `AA:BB:…` (comma separated) | Play Console → App signing |

Until they are set, `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json` return 404.

## Still to do with the apps

- App Store privacy labels and Play Data safety form (data collected is listed in the
  Privacy Policy page)
- A test login for app reviewers: a Firebase test phone number (Firebase console), never a code bypass
- "Hide a resident" (Profile) and Report already cover the stores' user-blocking rules
