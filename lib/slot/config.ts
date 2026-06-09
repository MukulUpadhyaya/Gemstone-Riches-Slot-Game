// Slot game configuration: symbols, payouts, layout

export const REELS = 5
export const ROWS = 3

export type SymbolId =
  | "ruby"
  | "sapphire"
  | "emerald"
  | "diamond"
  | "coin"
  | "crown"
  | "scatter"

export interface SymbolDef {
  id: SymbolId
  texture: string
  // payout multiplier (x bet) for 3 / 4 / 5 of a kind on a line
  pays: [number, number, number]
  weight: number // reel-strip frequency weight
}

export const SCATTER: SymbolId = "scatter"

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  crown: { id: "crown", texture: "/assets/symbols/crown.png", pays: [10, 40, 150], weight: 3 },
  diamond: { id: "diamond", texture: "/assets/symbols/diamond.png", pays: [6, 20, 80], weight: 5 },
  coin: { id: "coin", texture: "/assets/symbols/coin.png", pays: [4, 12, 50], weight: 6 },
  ruby: { id: "ruby", texture: "/assets/symbols/ruby.png", pays: [2, 8, 30], weight: 8 },
  emerald: { id: "emerald", texture: "/assets/symbols/emerald.png", pays: [2, 6, 25], weight: 9 },
  sapphire: { id: "sapphire", texture: "/assets/symbols/sapphire.png", pays: [1, 5, 20], weight: 10 },
  scatter: { id: "scatter", texture: "/assets/symbols/scatter.png", pays: [0, 0, 0], weight: 2 },
}

export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // middle
  [0, 0, 0, 0, 0], // top
  [2, 2, 2, 2, 2], // bottom
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // ^
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
]

export const SCATTERS_FOR_BONUS = 3
export const FREE_SPINS_AWARDED = 10

// Win tier thresholds as multiplier of total bet
export const BIG_WIN_MULT = 8
export const MEGA_WIN_MULT = 25

export const payingSymbols = (Object.keys(SYMBOLS) as SymbolId[]).filter(
  (s) => s !== SCATTER,
)

// Build a weighted reel strip
export function buildReelStrip(): SymbolId[] {
  const strip: SymbolId[] = []
  for (const id of Object.keys(SYMBOLS) as SymbolId[]) {
    const w = SYMBOLS[id].weight
    for (let i = 0; i < w; i++) strip.push(id)
  }
  // shuffle
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[strip[i], strip[j]] = [strip[j], strip[i]]
  }
  return strip
}
