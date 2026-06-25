/**
 * Akash — the grumpy detective mentor. A small, flat SVG character
 * (fedora, narrowed eyes, flat frown) so he has a face across the app.
 */
export default function AkashAvatar({
  size = 44,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Akash"
    >
      <circle cx="32" cy="32" r="32" fill="#22304f" />
      {/* shoulders / coat */}
      <path d="M14 64 v-6 a18 18 0 0 1 36 0 v6 z" fill="#2f4067" />
      <path d="M32 46 l5 18 h-10 z" fill="#dfe6f2" />
      {/* face */}
      <circle cx="32" cy="34" r="13" fill="#e7b893" />
      {/* hat brim + crown */}
      <ellipse cx="32" cy="23" rx="20" ry="5" fill="#15151b" />
      <path d="M20 23 v-3 a12 9 0 0 1 24 0 v3 z" fill="#1f1f27" />
      <rect x="20" y="20" width="24" height="3" rx="1.5" fill="#15151b" />
      {/* grumpy brows */}
      <rect x="23" y="31" width="8" height="2.4" rx="1.2" transform="rotate(12 27 32)" fill="#4a3526" />
      <rect x="33" y="31" width="8" height="2.4" rx="1.2" transform="rotate(-12 37 32)" fill="#4a3526" />
      {/* eyes */}
      <circle cx="27" cy="35" r="1.7" fill="#2a211b" />
      <circle cx="37" cy="35" r="1.7" fill="#2a211b" />
      {/* flat unimpressed mouth */}
      <rect x="27" y="41" width="10" height="2.2" rx="1.1" fill="#9c6b4c" />
    </svg>
  )
}
