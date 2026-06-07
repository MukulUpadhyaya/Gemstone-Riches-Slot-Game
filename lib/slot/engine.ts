import {
  REELS,
  ROWS,
  SYMBOLS,
  SCATTER,
  PAYLINES,
  payingSymbols,
  SCATTERS_FOR_BONUS,
  BIG_WIN_MULT,
  MEGA_WIN_MULT,
  type SymbolId,
} from "./config"

export type WinTier = "none" | "normal" | "big" | "mega"

export interface LineWin {
  line: number
  symbol: SymbolId
  count: number
  amount: number
  positions: [number, number][] // [reel, row]
}

export interface SpinResult {
  grid: SymbolId[][] // [reel][row]
  lineWins: LineWin[]
  totalWin: number
  scatterCount: number
  scatterPositions: [number, number][]
  triggeredBonus: boolean
  tier: WinTier
}

export type CheatMode = null | "bonus" | "bigwin" | "megawin"

function randomSymbol(excludeScatter = false): SymbolId {
  const pool = excludeScatter ? payingSymbols : (Object.keys(SYMBOLS) as SymbolId[])
  // weighted pick
  const weights = pool.map((s) => SYMBOLS[s].weight)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

function emptyGrid(): SymbolId[][] {
  const grid: SymbolId[][] = []
  for (let c = 0; c < REELS; c++) {
    const col: SymbolId[] = []
    for (let r = 0; r < ROWS; r++) col.push(randomSymbol())
    grid.push(col)
  }
  return grid
}

// Force a winning grid for a given target symbol on the middle line, padded
function forceLineWin(symbol: SymbolId, count: number): SymbolId[][] {
  const grid: SymbolId[][] = []
  for (let c = 0; c < REELS; c++) {
    const col: SymbolId[] = []
    for (let r = 0; r < ROWS; r++) {
      // middle row gets the target symbol for the first `count` reels
      if (r === 1 && c < count) col.push(symbol)
      else col.push(randomSymbol(true))
    }
    grid.push(col)
  }
  return grid
}

// Fill all rows with a symbol so most paylines hit -> huge multi-line win
function forceFullWin(symbol: SymbolId): SymbolId[][] {
  const grid: SymbolId[][] = []
  for (let c = 0; c < REELS; c++) {
    const col: SymbolId[] = []
    for (let r = 0; r < ROWS; r++) col.push(symbol)
    grid.push(col)
  }
  return grid
}

function placeScatters(grid: SymbolId[][], count: number) {
  const positions: [number, number][] = []
  const reels = [...Array(REELS).keys()]
  // shuffle reels
  for (let i = reels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[reels[i], reels[j]] = [reels[j], reels[i]]
  }
  for (let k = 0; k < count; k++) {
    const c = reels[k]
    const r = Math.floor(Math.random() * ROWS)
    grid[c][r] = SCATTER
    positions.push([c, r])
  }
  return positions
}

export function evaluate(grid: SymbolId[][], bet: number): SpinResult {
  const lineWins: LineWin[] = []
  const linePay = bet / PAYLINES.length // bet split across lines

  for (let l = 0; l < PAYLINES.length; l++) {
    const pattern = PAYLINES[l]
    const first = grid[0][pattern[0]]
    if (first === SCATTER) continue
    let count = 1
    const positions: [number, number][] = [[0, pattern[0]]]
    for (let c = 1; c < REELS; c++) {
      const sym = grid[c][pattern[c]]
      if (sym === first) {
        count++
        positions.push([c, pattern[c]])
      } else break
    }
    if (count >= 3) {
      const payIndex = count - 3
      const mult = SYMBOLS[first].pays[payIndex]
      if (mult > 0) {
        lineWins.push({
          line: l,
          symbol: first,
          count,
          amount: mult * linePay,
          positions: positions.slice(0, count),
        })
      }
    }
  }

  // scatters
  const scatterPositions: [number, number][] = []
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (grid[c][r] === SCATTER) scatterPositions.push([c, r])
    }
  }
  const scatterCount = scatterPositions.length
  const totalWin = lineWins.reduce((a, w) => a + w.amount, 0)
  const triggeredBonus = scatterCount >= SCATTERS_FOR_BONUS

  let tier: WinTier = "none"
  if (totalWin > 0) {
    const ratio = totalWin / bet
    if (ratio >= MEGA_WIN_MULT) tier = "mega"
    else if (ratio >= BIG_WIN_MULT) tier = "big"
    else tier = "normal"
  }

  return {
    grid,
    lineWins,
    totalWin,
    scatterCount,
    scatterPositions,
    triggeredBonus,
    tier,
  }
}

export function spin(bet: number, cheat: CheatMode = null): SpinResult {
  let grid: SymbolId[][]

  if (cheat === "bonus") {
    grid = emptyGrid()
    placeScatters(grid, SCATTERS_FOR_BONUS)
    return evaluate(grid, bet)
  }

  if (cheat === "bigwin") {
    // 5 diamonds on the middle line = 80x linePay = 8x bet -> big win range
    grid = forceLineWin("diamond", 5)
    return evaluate(grid, bet)
  }

  if (cheat === "megawin") {
    // full screen of crowns -> many paylines pay 150x linePay each -> mega
    grid = forceFullWin("crown")
    return evaluate(grid, bet)
  }

  grid = emptyGrid()
  return evaluate(grid, bet)
}

// A free-spin during the bonus round: boosted, no further scatter trigger handled by caller
export function bonusSpin(bet: number): SpinResult {
  const grid = emptyGrid()
  // boost: small chance to seed a high symbol line for excitement
  if (Math.random() < 0.45) {
    const sym = payingSymbols[Math.floor(Math.random() * 3)] // higher value group
    const count = Math.random() < 0.3 ? 5 : Math.random() < 0.5 ? 4 : 3
    for (let c = 0; c < count; c++) grid[c][1] = sym
  }
  return evaluate(grid, bet)
}
