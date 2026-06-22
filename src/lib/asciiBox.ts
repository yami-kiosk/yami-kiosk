const BOX_WIDTH = 24

function boxRow(content: string): string {
  const text = content.length > BOX_WIDTH ? content.slice(0, BOX_WIDTH) : content
  return `│${text.padEnd(BOX_WIDTH)}│`
}

function boxCenter(content: string): string {
  const text = content.length > BOX_WIDTH ? content.slice(0, BOX_WIDTH) : content
  const pad = BOX_WIDTH - text.length
  const left = Math.floor(pad / 2)
  return `│${' '.repeat(left)}${text}${' '.repeat(pad - left)}│`
}

export function buildVendingAscii(
  passiveRate: number,
  creditsPerMin: number,
): string {
  const border = '─'.repeat(BOX_WIDTH)
  const passive = passiveRate.toFixed(1).padStart(4)
  const credits = creditsPerMin.toFixed(1).padStart(4)

  return [
    `┌${border}┐`,
    boxCenter('▓ HACKED VENDING ▓'),
    boxRow(' STATUS: RUNNING'),
    boxRow(` PASSIVE: ${passive} $YEN/m`),
    boxRow(` CREDITS: ${credits}/m`),
    `└${border}┘`,
  ].join('\n')
}
