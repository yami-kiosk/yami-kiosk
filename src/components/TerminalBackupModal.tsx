import { Copy, X } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard } from '../lib/clipboard'

interface TerminalBackupModalProps {
  secretKey: string
  onClose: () => void
}

export function TerminalBackupModal({
  secretKey,
  onClose,
}: TerminalBackupModalProps) {
  const handleCopy = async () => {
    const success = await copyToClipboard(secretKey)
    if (success) {
      toast.success('Private key copied to clipboard!', {
        className: 'yami-toast',
      })
    } else {
      toast.error('Copy failed — terminal buffer unreachable.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="backup-modal relative w-full max-w-lg border border-neon-pink bg-black p-6 shadow-[0_0_40px_rgba(255,16,122,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="backup-modal-title"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-cyber-cyan/50 transition-colors hover:text-neon-pink"
          aria-label="Close backup modal"
        >
          <X size={18} />
        </button>

        <p className="font-mono text-[10px] tracking-[0.3em] text-terminal-green">
          {'>'} TERMINAL BACKUP // EXPORT KEY
        </p>
        <h2
          id="backup-modal-title"
          className="mt-2 font-vt323 text-2xl text-neon-pink"
        >
          BURNER WALLET EXPORT
        </h2>

        <div className="mt-4 border border-red-600/60 bg-red-950/20 p-4">
          <p className="font-mono text-xs font-bold leading-relaxed text-red-400">
            CRITICAL SECURITY WARNING: Keep this private key hidden. If exposed,
            the Megacorp Mainframe or rogue netrunners will wipe your terminal
            and drain your $YEN.
          </p>
        </div>

        <div className="mt-4">
          <p className="font-mono text-[10px] text-cyber-cyan/50">
            BASE58 SECRET KEY // PHANTOM IMPORT READY
          </p>
          <div className="mt-2 border border-neon-pink/30 bg-neon-pink/5 p-3">
            <p className="break-all font-mono text-xs text-neon-pink">{secretKey}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="terminal-btn glow-hover-pink mt-4 flex w-full items-center justify-center gap-2 border-2 border-neon-pink py-3 font-vt323 text-lg text-neon-pink"
        >
          <Copy size={16} />
          COPY PRIVATE KEY
        </button>

        <p className="mt-4 text-center font-mono text-[10px] text-cyber-cyan/30">
          Import via Phantom → Add / Connect Wallet → Import Private Key
        </p>
      </div>
    </div>
  )
}
