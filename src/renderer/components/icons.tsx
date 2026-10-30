// One icon family for the whole UI: outline, 2px stroke, round ends (Lucide-style paths).
// They are decorative: the button or text next to them carries the accessible name.
type IconProps = { className?: string }

function Icon({
  className = 'size-4',
  children
}: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  )
}

export const XIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
)

export const ClockIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Icon>
)

export const RefreshIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </Icon>
)

export const ChevronDownIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const ChevronRightIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
)

export const ChevronLeftIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)

export const CheckSquareIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m9 11 3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Icon>
)

export const AlertIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
)

export const CircleCheckIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)

export const PlugIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  </Icon>
)

// ---- settings sections ----

export const MonitorIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
  </Icon>
)

export const PanelRightIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M15 3v18" />
  </Icon>
)

export const UsersIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
)

export const EyeIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const SparklesIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </Icon>
)

export const BellIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icon>
)

export const SlidersIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M4 21v-7" />
    <path d="M4 10V3" />
    <path d="M12 21v-9" />
    <path d="M12 8V3" />
    <path d="M20 21v-5" />
    <path d="M20 12V3" />
    <path d="M2 14h4" />
    <path d="M10 8h4" />
    <path d="M18 16h4" />
  </Icon>
)

// Simplified one-color marks of each platform (they take the color of the text around them).
export const GmailIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
    <path d="m3 7 9 6.5L21 7" />
  </Icon>
)

export const SlackIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M9.5 3 8 21" />
    <path d="M16 3l-1.5 18" />
    <path d="M4 9h17" />
    <path d="M3 15.5h17" />
  </Icon>
)

export const ClickUpIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="m4 16 4.2-3.4a5.5 5.5 0 0 1 7.6 0L20 16" />
    <path d="m7.5 8.5 3.7-3.2a1.2 1.2 0 0 1 1.6 0l3.7 3.2" />
  </Icon>
)

export const CalendarIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
  </Icon>
)

export const TrashIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v5M14 11v5" />
  </Icon>
)
