import { ClubHouseLogo } from '@/components/ClubHouseLogo';
import { APP_NAME } from '@/lib/brand';

/** Full-screen loading state shown while the app checks who is signed in */
export function ClubHouseLoading() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-[90vh] bg-ivory text-ink gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-20 h-20">
        <span className="absolute inset-0 rounded-card bg-terracotta/25 motion-safe:animate-ping" aria-hidden="true" />
        <div className="relative w-20 h-20 rounded-card bg-terracotta-deep text-ink-inverse shadow-raised flex items-center justify-center">
          <ClubHouseLogo className="w-11 h-11" />
        </div>
      </div>
      <p className="font-display text-section font-bold">{APP_NAME}</p>
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 rounded-full bg-terracotta-deep motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">Loading {APP_NAME}</span>
    </div>
  );
}
