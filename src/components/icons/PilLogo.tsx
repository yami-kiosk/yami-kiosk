interface PilLogoProps {
  size?: number
  strokeWidth?: number
  className?: string
}

/**
 * Terminal-themed pump.fun pill — diagonal capsule, stroke style like lucide icons.
 */
export function PilLogo({
  size = 18,
  strokeWidth = 2,
  className = '',
}: PilLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g transform="translate(12 12) rotate(-45) translate(-12 -12)">
        {/* shaded half */}
        <path
          d="M12 8.75h6.75a2.25 2.25 0 0 1 2.25 2.25v1.5a2.25 2.25 0 0 1-2.25 2.25H12V8.75Z"
          fill="currentColor"
          fillOpacity={0.22}
          stroke="none"
        />

        {/* capsule outline */}
        <rect
          x="5.25"
          y="8.75"
          width="13.5"
          height="6.5"
          rx="3.25"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />

        {/* center seam */}
        <line
          x1="12"
          y1="8.75"
          x2="12"
          y2="15.25"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* gloss ticks — pump.fun pill detail */}
        <path
          d="M7.4 10.6c-.55.85-.55 1.95 0 2.8"
          stroke="currentColor"
          strokeWidth={1.15}
          strokeLinecap="round"
          opacity={0.55}
        />
        <path
          d="M8.35 11.15c-.35.55-.35 1.15 0 1.7"
          stroke="currentColor"
          strokeWidth={1.15}
          strokeLinecap="round"
          opacity={0.35}
        />
      </g>
    </svg>
  )
}
