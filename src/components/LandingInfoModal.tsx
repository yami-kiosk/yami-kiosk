import { X } from 'lucide-react'
import type { LandingDoc } from '../constants/landingDocs'

interface LandingInfoModalProps {
  doc: LandingDoc
  onClose: () => void
}

export function LandingInfoModal({ doc, onClose }: LandingInfoModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="landing-info-modal relative flex max-h-[85vh] w-full max-w-lg flex-col border border-cyber-cyan/40 bg-black shadow-[0_0_40px_rgba(0,255,255,0.15)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby={`landing-doc-${doc.id}`}
        aria-modal="true"
      >
        <div className="shrink-0 border-b border-cyber-cyan/20 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-cyber-cyan/50 transition-colors hover:text-neon-pink"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <p className="font-mono text-[10px] tracking-[0.3em] text-terminal-green">
            {'>'} {doc.subtitle}
          </p>
          <h2
            id={`landing-doc-${doc.id}`}
            className="mt-1 font-vt323 text-3xl tracking-wider text-neon-pink"
          >
            {doc.title}
          </h2>
        </div>

        <div className="landing-doc-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="space-y-5">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="font-mono text-[10px] tracking-[0.2em] text-cyber-cyan">
                  // {section.heading}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {section.lines.map((line) => (
                    <li
                      key={line}
                      className="font-mono text-[11px] leading-relaxed text-cyber-cyan/75 before:mr-1.5 before:text-neon-pink before:content-['>']"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-cyber-cyan/15 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="landing-nav-btn w-full border-neon-pink/50 text-neon-pink hover:border-neon-pink"
          >
            [ CLOSE TERMINAL ]
          </button>
        </div>
      </div>
    </div>
  )
}
