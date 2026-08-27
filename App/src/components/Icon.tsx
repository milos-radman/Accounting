// Minimal stroke icon set (lucide-style), rendered inline so they inherit currentColor
const paths: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  building: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20" />
      <path d="M7.5 8h2M7.5 12h2M7.5 16h2" />
    </>
  ),
  plug: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.6 5 8.6 4.2 6 4.2c-1.2 0-2.2.2-3 .5v14.5c.8-.3 1.8-.5 3-.5 2.6 0 4.6.8 6 2.3 1.4-1.5 3.4-2.3 6-2.3 1.2 0 2.2.2 3 .5V4.7c-.8-.3-1.8-.5-3-.5-2.6 0-4.6.8-6 2.3Z" />
      <path d="M12 6.5V21" />
    </>
  ),
  rows: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.3h18M3 14.6h18M8 4v16" />
    </>
  ),
  puzzle: (
    <path d="M14 3.5a2 2 0 0 1 4 0V5h2a1.5 1.5 0 0 1 1.5 1.5v3.2h-1.3a2.2 2.2 0 0 0 0 4.4h1.3v3.4A1.5 1.5 0 0 1 20 19h-3.3v1.3a2.2 2.2 0 0 1-4.4 0V19H9a1.5 1.5 0 0 1-1.5-1.5v-2.7H6.2a2.2 2.2 0 0 1 0-4.4h1.3V7A1.5 1.5 0 0 1 9 5.5h5V3.5Z" />
  ),
  sigma: <path d="M17 5H7l6 7-6 7h10M17 5v2M17 19v-2" />,
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h16" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </>
  ),
  swap: <path d="M7 4v13M7 4 4 7m3-3 3 3M17 20V7m0 13 3-3m-3 3-3-3" />,
  pencil: <path d="M4 20h4L20 8a2.3 2.3 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />,
  file: (
    <>
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5L14 3Z" />
      <path d="M14 3v4.5h4.5M9 12.5h6M9 16h6" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M6 7l6-2 6 2M4 20h16" />
      <path d="M6 7 3.5 13a2.8 2.8 0 0 0 5 0L6 7ZM18 7l-2.5 6a2.8 2.8 0 0 0 5 0L18 7Z" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5 12 21l8.5-8.5L12 4H5a1.5 1.5 0 0 0-1.5 1.5v7Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="6.5" rx="6" ry="2.8" />
      <path d="M3 6.5v5c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-5" />
      <path d="M3 11.5v5c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8M18.5 9.5c1.5.4 2.5 1.2 2.5 2.2v5c0 1.4-2.2 2.6-5 2.8" />
    </>
  ),
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />,
  zap: <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5S9.5 5.8 12 3.5Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowRight: <path d="M4 12h16m0 0-6-6m6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 2.8V6.5M16 2.8V6.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  download: <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 20h16" />,
};

export function Icon({ name, size = 17, className, strokeWidth = 1.7 }: {
  name: string; size?: number; className?: string; strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
