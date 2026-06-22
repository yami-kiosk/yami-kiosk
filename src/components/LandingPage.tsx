import { BarChart3, Copy, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PLACEHOLDER_CA, SOCIAL_LINKS } from '../constants/contracts'
import {
  LANDING_DOCS,
  type LandingDocId,
} from '../constants/landingDocs'
import { copyToClipboard } from '../lib/clipboard'
import { PilLogo } from './icons/PilLogo'
import { LandingInfoModal } from './LandingInfoModal'

interface LandingPageProps {
  onEnter: () => void
}

const DOC_BUTTONS: { id: LandingDocId; label: string }[] = [
  { id: 'gameplay', label: 'GAMEPLAY' },
  { id: 'wiki', label: 'WIKI' },
  { id: 'faq', label: 'FAQ' },
]

export function LandingPage({ onEnter }: LandingPageProps) {
  const [activeDoc, setActiveDoc] = useState<LandingDocId | null>(null)
  const handleCopyCA = async () => {
    const success = await copyToClipboard(PLACEHOLDER_CA)
    if (success) {
      toast.success('CA Copied to Mainframe!', {
        className: 'yami-toast',
      })
    } else {
      toast.error('Copy failed — mainframe unreachable.')
    }
  }

  return (
    <div className="landing-screen scanlines flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="landing-frame w-full max-w-lg">
        <div className="landing-frame-corner landing-frame-corner-tl" />
        <div className="landing-frame-corner landing-frame-corner-tr" />
        <div className="landing-frame-corner landing-frame-corner-bl" />
        <div className="landing-frame-corner landing-frame-corner-br" />

        <div className="relative border border-cyber-cyan/30 bg-black p-8 md:p-10">
          <p className="mb-6 text-center font-mono text-[10px] tracking-[0.35em] text-terminal-green">
            {'>'} UNAUTHORIZED ACCESS DETECTED_
          </p>

          <div className="text-center">
            <h1
              className="glitch-text font-vt323 text-5xl tracking-wider text-cyber-cyan md:text-7xl"
              data-text="YAMI KIOSK"
            >
              YAMI KIOSK
            </h1>
            <p className="mt-2 font-vt323 text-2xl text-terminal-green md:text-3xl">
              ヤミキオスク
            </p>
            <p className="mt-4 font-mono text-xs text-cyber-cyan/50">
              // illegal hacked vending node // black market $YEN //
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <a
              href={SOCIAL_LINKS.x}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-social-btn"
              aria-label="X (Twitter)"
            >
              <X size={18} strokeWidth={2} />
              <span className="sr-only">X</span>
            </a>
            <a
              href={SOCIAL_LINKS.dexscreener}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-social-btn"
              aria-label="Dexscreener"
            >
              <BarChart3 size={18} strokeWidth={2} />
              <span className="sr-only">Dexscreener</span>
            </a>
            <a
              href={SOCIAL_LINKS.pumpfun}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-social-btn"
              aria-label="Pump.fun"
            >
              <PilLogo size={18} strokeWidth={2} />
              <span className="sr-only">Pump.fun</span>
            </a>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {DOC_BUTTONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveDoc(id)}
                className="landing-nav-btn"
              >
                [ {label} ]
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyCA}
            className="landing-ca-box group mt-8 w-full text-left"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-terminal-green">
                CONTRACT_ADDRESS // CA
              </span>
              <Copy
                size={14}
                className="text-cyber-cyan/40 transition-colors group-hover:text-neon-pink"
              />
            </div>
            <p className="mt-2 break-all font-mono text-xs text-cyber-cyan transition-colors group-hover:text-neon-pink md:text-sm">
              {PLACEHOLDER_CA}
            </p>
            <p className="mt-2 font-mono text-[10px] text-cyber-cyan/30 group-hover:text-neon-pink/60">
              [ CLICK TO COPY TO MAINFRAME ]
            </p>
          </button>

          <button
            type="button"
            onClick={onEnter}
            className="landing-enter-btn mt-8 w-full"
          >
            BYPASS SECURITY [ENTER KIOSK]
          </button>

          <p className="mt-6 text-center font-mono text-[10px] text-cyber-cyan/25">
            v0.1.0 // SOLANA // PLAY-TO-EARN // $YAMI $YEN
          </p>
        </div>
      </div>

      {activeDoc && (
        <LandingInfoModal
          doc={LANDING_DOCS[activeDoc]}
          onClose={() => setActiveDoc(null)}
        />
      )}
    </div>
  )
}
