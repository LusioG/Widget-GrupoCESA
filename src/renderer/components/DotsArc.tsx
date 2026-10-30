// Decorative motif taken from the Grupo CESA logo: an open "C" arc followed by a column of dots.
type Props = { className?: string }

export function DotsArc({ className }: Props): React.JSX.Element {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <path
        d="M 98 62 A 42 42 0 1 0 98 138"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="butt"
      />
      <circle cx="117" cy="62" r="6" fill="currentColor" />
      <circle cx="133" cy="78" r="6.5" fill="currentColor" />
      <circle cx="140" cy="100" r="7" fill="currentColor" />
      <circle cx="133" cy="122" r="6.5" fill="currentColor" />
      <circle cx="117" cy="138" r="6" fill="currentColor" />
    </svg>
  )
}

// Thin separator that fades out, with the logo's dots in the middle.
export function DotsDivider(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-4 py-1" aria-hidden="true">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cesa-600" />
      <div className="flex gap-1">
        {[0.35, 0.6, 1, 0.6, 0.35].map((o, i) => (
          <span key={i} className="size-1 rounded-full bg-cesa-green" style={{ opacity: o }} />
        ))}
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-cesa-600" />
    </div>
  )
}
