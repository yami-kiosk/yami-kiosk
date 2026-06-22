import { useSupabaseStatus } from '../hooks/useSupabaseStatus'

interface SyndicateNetworkBadgeProps {
  compact?: boolean
}

export function SyndicateNetworkBadge({ compact = false }: SyndicateNetworkBadgeProps) {
  const { status, message } = useSupabaseStatus()

  if (status === 'unconfigured') {
    return compact ? null : (
      <p className="font-mono text-[8px] text-cyber-cyan/35">
        SYNDICATE: LOCAL ONLY
      </p>
    )
  }

  const label =
    status === 'checking'
      ? 'SYNC…'
      : status === 'online'
        ? 'LIVE'
        : 'OFFLINE'

  const color =
    status === 'online'
      ? 'text-terminal-green border-terminal-green/40 bg-terminal-green/10'
      : status === 'checking'
        ? 'text-cyber-cyan/60 border-cyber-cyan/30 bg-cyber-cyan/5'
        : 'text-lobster-red border-lobster-red/40 bg-lobster-red/10'

  return (
    <div className={compact ? '' : 'space-y-0.5'}>
      <span
        className={`inline-block border px-1.5 py-0.5 font-mono text-[7px] tracking-wider md:text-[8px] ${color}`}
        title={message ?? undefined}
      >
        SYNDICATE {label}
      </span>
      {!compact && status === 'offline' && message ? (
        <p className="font-mono text-[7px] leading-snug text-lobster-red/80">
          {message}
        </p>
      ) : null}
    </div>
  )
}
