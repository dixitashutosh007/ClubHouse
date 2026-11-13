# Operations runbook

How to look after the production Firebase project `saath-societyapps` (Firestore
database `(default)`, region `asia-south1`). Run the commands in Google Cloud Shell
(https://shell.cloud.google.com) while signed in as a project owner.

## Backups (roadmap 5.3)

Firestore managed backups copy the whole database on a schedule. They need no code and
no bucket. A database can have one daily and one weekly schedule.

### Turn them on (once)

```bash
gcloud config set project saath-societyapps

# Every day, kept for 14 days
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=daily --retention=14d

# Every Sunday, kept for 8 weeks
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=weekly --day-of-week=SUN --retention=8w
```

### Check they are running

```bash
gcloud firestore backups schedules list --database='(default)'
gcloud firestore backups list --location=asia-south1   # appears a day after turning on
```

Cost: backups are billed per GB stored. While the society is small the database is a
few MB, so this is a few rupees a month.

### Restore

A restore always creates a **new** database next to the live one; it never overwrites
`(default)`.

1. Find the backup: `gcloud firestore backups list --location=asia-south1`
2. Restore it into a new database:
   ```bash
   gcloud firestore databases restore \
     --source-backup=projects/saath-societyapps/locations/asia-south1/backups/BACKUP_ID \
     --destination-database=restore-YYYYMMDD
   ```
3. Inspect it in the Firebase console (database selector at the top of Firestore).
4. Copy back what is needed. For a full rollback, point the app at the restored database
   (needs a small code change in `src/lib/firebase/admin.ts`); ask before doing this.
5. Delete the restored database when finished:
   `gcloud firestore databases delete --database=restore-YYYYMMDD`

## Indexes and rules

`firestore.indexes.json` and `firestore.rules` in the repo are the source of truth.
Deploy changes with `firebase deploy --only firestore:indexes` (or `firestore:rules`)
from the repo root. When the CLI offers to delete indexes that are not in the file,
answer **No** and check first.

## Making someone App Admin

The app never grants `SUPER_ADMIN` itself. After the person has signed in once:

```bash
npm ci --legacy-peer-deps
npm run grant-app-admin -- --phone 98XXXXXXXX            # dry run
npm run grant-app-admin -- --phone 98XXXXXXXX --apply
```

## Push notifications (roadmap 1.1)

Alerts reach phones even when Club House is closed once web push is configured:

1. Firebase console → Project settings → **Cloud Messaging** → *Web Push certificates* → **Generate key pair**.
   Copy the public key.
2. Amplify → App settings → Environment variables: add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` = that key, then redeploy.
   (It is a public key; it is safe in the browser.)
3. Google Cloud console → APIs: make sure **Firebase Cloud Messaging API** is enabled for the project
   (it usually is). The server sends with the existing `FIREBASE_SERVICE_ACCOUNT_KEY`.
4. Residents turn alerts on from the bell → **Enable Push**. On iPhone this works only after
   "Add to Home Screen" (iOS 16.4+).

Without the key the app still shows pop-ups while it is open. Device tokens live in the
`push_devices` collection (server-only); tokens that stop working are removed automatically.
Optional: add a Firestore TTL policy on `rate_limits.expireAt` to clean up old rate-limit windows.
