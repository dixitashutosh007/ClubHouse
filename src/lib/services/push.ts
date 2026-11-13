import { createHash } from 'crypto';
import { ISocietyRepository } from '@/lib/db/repository.interface';
import { InAppNotification } from '@/types';

/** Push device IDs are a hash of the FCM token (tokens are long and secret-ish) */
export function pushDeviceId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** FCM errors meaning the token will never work again */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

interface MulticastSender {
  sendEachForMulticast(message: {
    tokens: string[];
    data: Record<string, string>;
    webpush?: { headers?: Record<string, string>; fcmOptions?: { link?: string } };
  }): Promise<{ responses: { success: boolean; error?: { code: string } }[] }>;
}

/** Real FCM in production with server credentials; nothing elsewhere (development, tests) */
async function defaultSender(): Promise<MulticastSender | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  const admin = await import('@/lib/firebase/admin');
  return admin.hasFirebaseCredentials() ? (admin.adminMessaging as unknown as MulticastSender) : null;
}

/**
 * Sends a notification to every device the user enabled push on. Failures
 * never fail the request that triggered them; dead tokens are removed.
 */
export async function sendPush(
  repo: ISocietyRepository,
  notification: InAppNotification,
  sender?: MulticastSender | null
): Promise<number> {
  try {
    const messaging = sender === undefined ? await defaultSender() : sender;
    if (!messaging) return 0;
    const devices = await repo.listPushDevices(notification.userId);
    if (devices.length === 0) return 0;

    const result = await messaging.sendEachForMulticast({
      tokens: devices.map((d) => d.token),
      // Data-only, so the app's service worker decides how to show it
      data: {
        title: notification.title,
        body: notification.body,
        url: notification.link ?? '/',
        tag: notification.id,
        type: notification.type,
      },
      webpush: { headers: { Urgency: 'high', TTL: String(60 * 60 * 6) } },
    });

    let sent = 0;
    await Promise.all(
      result.responses.map(async (r, i) => {
        if (r.success) sent++;
        else if (r.error && DEAD_TOKEN_ERRORS.has(r.error.code)) await repo.deletePushDevice(devices[i].id);
      })
    );
    return sent;
  } catch (err) {
    console.error('Push notification failed', err);
    return 0;
  }
}

/** Records an in-app notification and pushes it to the user's devices */
export async function notify(repo: ISocietyRepository, notification: InAppNotification): Promise<InAppNotification> {
  const saved = await repo.createNotification(notification);
  await sendPush(repo, saved);
  return saved;
}
