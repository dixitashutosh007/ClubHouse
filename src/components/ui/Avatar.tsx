/** A resident's photo, or their initials when they haven't added one */
export function Avatar({ name, photoUrl, size = 32 }: { name?: string; photoUrl?: string; size?: number }) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() : '?';
  const style = { width: size, height: size };
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photos are small inline data URLs
      <img src={photoUrl} alt="" style={style} className="rounded-full object-cover shrink-0 bg-sunken" />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      className="rounded-full bg-home-tint text-home-deep font-bold flex items-center justify-center shrink-0"
    >
      {initials}
    </span>
  );
}
