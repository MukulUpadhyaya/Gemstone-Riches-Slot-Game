import {
  Application,
  Container,
  Sprite,
  Texture,
  Assets,
  Graphics,
  Text,
  TextStyle,
  Ticker,
} from "pixi.js"
import { REELS, ROWS, SYMBOLS, type SymbolId } from "./config"
import type { SpinResult, LineWin } from "./engine"

const SYMBOL_SIZE = 132
const SYMBOL_GAP = 8
const CELL = SYMBOL_SIZE + SYMBOL_GAP
const REEL_W = CELL
const BOARD_W = REELS * CELL
const BOARD_H = ROWS * CELL

interface ReelCell {
  sprite: Sprite
  id: SymbolId
}

export interface SlotRendererCallbacks {
  onSpinComplete?: () => void
}

export class SlotRenderer {
  app: Application
  private stage = new Container()
  private board = new Container()
  private reels: Container[] = []
  private cells: ReelCell[][] = [] // [reel][rowIndex 0..ROWS+pad]
  private textures: Partial<Record<SymbolId, Texture>> = {}
  private fxLayer = new Container()
  private spinning = false
  private callbacks: SlotRendererCallbacks
  private destroyed = false

  // per-reel animation state
  private reelOffsets: number[] = []
  private reelSpeeds: number[] = []
  private reelStopping: boolean[] = []
  private reelFinalGrid: SymbolId[][] = []
  private spinTickerFn?: (t: Ticker) => void

  constructor(callbacks: SlotRendererCallbacks = {}) {
    this.callbacks = callbacks
    this.app = new Application()
  }

  async init(canvasParent: HTMLDivElement) {
    await this.app.init({
      width: BOARD_W + 40,
      height: BOARD_H + 40,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    if (this.destroyed) {
      this.app.destroy(true)
      return
    }
    canvasParent.appendChild(this.app.canvas)

    // load textures
    const entries = Object.values(SYMBOLS)
    await Promise.all(
      entries.map(async (s) => {
        this.textures[s.id] = await Assets.load(s.texture)
      }),
    )
    if (this.destroyed) return

    this.app.stage.addChild(this.stage)
    this.stage.x = 20
    this.stage.y = 20

    // board frame
    const frame = new Graphics()
    frame
      .roundRect(-8, -8, BOARD_W + 16, BOARD_H + 16, 16)
      .fill({ color: 0x0b1026, alpha: 0.55 })
      .stroke({ width: 3, color: 0xffd24a, alpha: 0.9 })
    this.stage.addChild(frame)

    this.stage.addChild(this.board)

    // mask so symbols outside the board are clipped
    const mask = new Graphics().rect(0, 0, BOARD_W, BOARD_H).fill(0xffffff)
    this.board.addChild(mask)
    this.board.mask = mask

    this.buildReels()
    this.stage.addChild(this.fxLayer)
  }

  private buildReels() {
    for (let c = 0; c < REELS; c++) {
      const reel = new Container()
      reel.x = c * CELL
      this.board.addChild(reel)
      this.reels.push(reel)
      const col: ReelCell[] = []
      // ROWS visible + 1 above for smooth scroll
      for (let r = -1; r < ROWS; r++) {
        const id = this.randomId()
        const sprite = this.makeSymbol(id)
        sprite.y = r * CELL
        reel.addChild(sprite)
        col.push({ sprite, id })
      }
      this.cells.push(col)
      this.reelOffsets.push(0)
      this.reelSpeeds.push(0)
      this.reelStopping.push(false)
    }
  }

  private randomId(): SymbolId {
    const ids = Object.keys(SYMBOLS) as SymbolId[]
    return ids[Math.floor(Math.random() * ids.length)]
  }

  private makeSymbol(id: SymbolId): Sprite {
    const sprite = new Sprite(this.textures[id])
    sprite.width = SYMBOL_SIZE
    sprite.height = SYMBOL_SIZE
    sprite.x = SYMBOL_GAP / 2
    return sprite
  }

  private setCellTexture(cell: ReelCell, id: SymbolId) {
    cell.id = id
    cell.sprite.texture = this.textures[id]!
  }

  // Public: start spin, resolve final grid after animation
  spin(result: SpinResult): Promise<void> {
    return new Promise((resolve) => {
      if (this.spinning) {
        resolve()
        return
      }
      this.spinning = true
      this.clearFx()
      this.reelFinalGrid = result.grid

      const startTime = performance.now()
      const reelStopTimes = [600, 800, 1000, 1200, 1450] // ms per reel
      const maxSpeed = 55

      // how many more cell-shifts each reel does once it begins settling,
      // so the final symbols scroll in cleanly before snapping
      const shiftsAfterStop = new Array(REELS).fill(0)

      for (let c = 0; c < REELS; c++) {
        this.reelSpeeds[c] = maxSpeed
        this.reelStopping[c] = false
        shiftsAfterStop[c] = 0
      }

      const stopped = new Array(REELS).fill(false)
      const MIN_STOP_SPEED = 14 // never decay below this, prevents deadlock
      const SHIFTS_TO_SETTLE = 3

      const tick = (ticker: Ticker) => {
        const now = performance.now()
        const elapsed = now - startTime
        const delta = ticker.deltaTime

        for (let c = 0; c < REELS; c++) {
          if (stopped[c]) continue

          // begin settling this reel once its time elapses
          if (elapsed >= reelStopTimes[c] && !this.reelStopping[c]) {
            this.reelStopping[c] = true
          }

          // advance reel
          this.reelOffsets[c] += this.reelSpeeds[c] * delta
          while (this.reelOffsets[c] >= CELL) {
            this.reelOffsets[c] -= CELL
            this.shiftReelDown(c)
            if (this.reelStopping[c]) {
              shiftsAfterStop[c]++
              // on the final settling shift, snap exactly into place
              if (shiftsAfterStop[c] >= SHIFTS_TO_SETTLE) {
                this.reelOffsets[c] = 0
                this.snapReel(c)
                stopped[c] = true
                this.bounceReel(c)
                break
              }
            }
          }

          if (stopped[c]) continue

          // when settling, lock the incoming top cell to the final symbol
          // so the correct symbols visibly roll into view
          if (this.reelStopping[c]) {
            this.reelSpeeds[c] = Math.max(
              this.reelSpeeds[c] * 0.9,
              MIN_STOP_SPEED,
            )
            this.lockReelToFinal(c, shiftsAfterStop[c])
          }

          this.applyReelOffset(c)
        }

        if (stopped.every(Boolean)) {
          this.app.ticker.remove(tick)
          this.spinning = false
          this.highlightWins(result)
          this.callbacks.onSpinComplete?.()
          resolve()
        }
      }
      this.spinTickerFn = tick
      this.app.ticker.add(tick)
    })
  }

  private shiftReelDown(c: number) {
    // move bottom sprite to top, give random texture (will be corrected when locking)
    const col = this.cells[c]
    col.unshift(col.pop()!)
    if (!this.reelStopping[c]) {
      this.setCellTexture(col[0], this.randomId())
    }
    // reposition
    for (let i = 0; i < col.length; i++) {
      col[i].sprite.y = (i - 1) * CELL
    }
  }

  private lockReelToFinal(c: number, shiftsSoFar: number) {
    // While settling, feed the final symbols into the incoming top cell so
    // the correct result visibly rolls into place before the snap.
    const col = this.cells[c]
    // map remaining shifts to final rows (top row enters first)
    const row = Math.min(ROWS - 1, Math.max(0, shiftsSoFar))
    this.setCellTexture(col[0], this.reelFinalGrid[c][row])
  }

  private snapReel(c: number) {
    const col = this.cells[c]
    // visible cells are indices 1..ROWS
    for (let r = 0; r < ROWS; r++) {
      this.setCellTexture(col[r + 1], this.reelFinalGrid[c][r])
      col[r + 1].sprite.y = r * CELL
    }
    // hidden top
    this.setCellTexture(col[0], this.reelFinalGrid[c][0])
    col[0].sprite.y = -CELL
  }

  private applyReelOffset(c: number) {
    const col = this.cells[c]
    for (let i = 0; i < col.length; i++) {
      col[i].sprite.y = (i - 1) * CELL + this.reelOffsets[c]
    }
  }

  private bounceReel(c: number) {
    const col = this.cells[c]
    let t = 0
    const dur = 14
    const amp = 10
    const fn = (ticker: Ticker) => {
      t += ticker.deltaTime
      const k = Math.sin((t / dur) * Math.PI) * amp * (1 - t / dur)
      for (let r = 0; r < ROWS; r++) col[r + 1].sprite.y = r * CELL + k
      if (t >= dur) {
        for (let r = 0; r < ROWS; r++) col[r + 1].sprite.y = r * CELL
        this.app.ticker.remove(fn)
      }
    }
    this.app.ticker.add(fn)
  }

  // ---- Win highlighting ----
  private fxTickers: ((t: Ticker) => void)[] = []

  private highlightWins(result: SpinResult) {
    // pulse winning symbols
    const winningCells = new Set<string>()
    result.lineWins.forEach((w) =>
      w.positions.forEach(([c, r]) => winningCells.add(`${c}:${r}`)),
    )
    result.scatterPositions.forEach(([c, r]) => winningCells.add(`${c}:${r}`))

    if (winningCells.size === 0) return

    winningCells.forEach((key) => {
      const [c, r] = key.split(":").map(Number)
      const sprite = this.cells[c][r + 1].sprite
      const glow = new Graphics()
      glow
        .roundRect(c * CELL + 2, r * CELL + 2, SYMBOL_SIZE, SYMBOL_SIZE, 12)
        .stroke({ width: 4, color: 0xffd24a, alpha: 0.95 })
      this.fxLayer.addChild(glow)
      let t = 0
      const fn = (ticker: Ticker) => {
        t += ticker.deltaTime * 0.1
        const s = 1 + Math.sin(t) * 0.08
        sprite.scale.set((SYMBOL_SIZE / sprite.texture.width) * s)
        glow.alpha = 0.5 + Math.sin(t) * 0.4
      }
      this.fxTickers.push(fn)
      this.app.ticker.add(fn)
    })

    // draw payline paths briefly
    result.lineWins.forEach((w, i) => this.drawPayline(w, i))
  }

  private drawPayline(w: LineWin, idx: number) {
    const colors = [0x4ade80, 0x60a5fa, 0xf472b6, 0xfbbf24, 0xf87171]
    const g = new Graphics()
    const color = colors[idx % colors.length]
    w.positions.forEach(([c, r], i) => {
      const x = c * CELL + CELL / 2
      const y = r * CELL + CELL / 2
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    })
    g.stroke({ width: 5, color, alpha: 0.85 })
    this.fxLayer.addChild(g)
  }

  private clearFx() {
    this.fxTickers.forEach((fn) => this.app.ticker.remove(fn))
    this.fxTickers = []
    this.fxLayer.removeChildren()
    // reset symbol scales
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const sp = this.cells[c][r + 1].sprite
        sp.width = SYMBOL_SIZE
        sp.height = SYMBOL_SIZE
      }
    }
  }

  // ---- Big / Mega win celebration ----
  async playWinCelebration(
    tier: "big" | "mega",
    amount: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const overlay = new Container()
      this.app.stage.addChild(overlay)

      const dim = new Graphics()
        .rect(0, 0, this.app.screen.width, this.app.screen.height)
        .fill({ color: 0x000010, alpha: 0.0 })
      overlay.addChild(dim)

      const cx = this.app.screen.width / 2
      const cy = this.app.screen.height / 2

      const isMega = tier === "mega"
      const titleStr = isMega ? "MEGA WIN" : "BIG WIN"
      const mainColor = isMega ? "#ff3b6b" : "#ffd24a"

      const titleStyle = new TextStyle({
        fontFamily: "Geist, Arial, sans-serif",
        fontSize: isMega ? 72 : 58,
        fontWeight: "900",
        fill: mainColor,
        stroke: { color: "#1a0b2e", width: 8 },
        dropShadow: {
          color: isMega ? "#ff3b6b" : "#ffae00",
          blur: 16,
          distance: 0,
          alpha: 0.9,
        },
        letterSpacing: 4,
        align: "center",
      })
      const title = new Text({ text: titleStr, style: titleStyle })
      title.anchor.set(0.5)
      title.x = cx
      title.y = cy - 50
      title.scale.set(0)
      overlay.addChild(title)

      const amountStyle = new TextStyle({
        fontFamily: "Geist, Arial, sans-serif",
        fontSize: 46,
        fontWeight: "800",
        fill: "#ffffff",
        stroke: { color: "#1a0b2e", width: 6 },
        dropShadow: { color: "#000000", blur: 6, distance: 2, alpha: 0.6 },
      })
      const amountText = new Text({ text: "0", style: amountStyle })
      amountText.anchor.set(0.5)
      amountText.x = cx
      amountText.y = cy + 40
      amountText.alpha = 0
      overlay.addChild(amountText)

      // coin/particle burst
      const particles: { g: Graphics; vx: number; vy: number; life: number }[] =
        []
      const burst = () => {
        for (let i = 0; i < (isMega ? 40 : 24); i++) {
          const g = new Graphics()
          const col = Math.random() > 0.5 ? 0xffd24a : 0xff6b8b
          g.circle(0, 0, 4 + Math.random() * 6).fill(col)
          g.x = cx
          g.y = cy
          overlay.addChild(g)
          const ang = Math.random() * Math.PI * 2
          const spd = 4 + Math.random() * 9
          particles.push({
            g,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 4,
            life: 60 + Math.random() * 40,
          })
        }
      }

      let t = 0
      const totalDur = isMega ? 230 : 170
      let counted = 0
      burst()
      const fn = (ticker: Ticker) => {
        const d = ticker.deltaTime
        t += d
        dim.alpha = Math.min(0.7, dim.alpha + 0.04 * d)

        // title pop with elastic
        if (title.scale.x < 1) {
          const ns = Math.min(1, title.scale.x + 0.12 * d)
          title.scale.set(ns)
        } else {
          title.scale.set(1 + Math.sin(t * 0.15) * 0.04)
        }
        title.rotation = Math.sin(t * 0.1) * 0.02

        // amount count up
        amountText.alpha = Math.min(1, amountText.alpha + 0.05 * d)
        counted = Math.min(amount, counted + (amount / 70) * d)
        amountText.text = Math.floor(counted).toLocaleString()

        if (t > totalDur * 0.45 && t < totalDur * 0.5) burst()

        // particles
        for (const p of particles) {
          p.life -= d
          p.vy += 0.25 * d
          p.g.x += p.vx * d
          p.g.y += p.vy * d
          p.g.alpha = Math.max(0, p.life / 60)
        }

        if (t >= totalDur) {
          // fade out
          overlay.alpha -= 0.06 * d
          if (overlay.alpha <= 0) {
            this.app.ticker.remove(fn)
            overlay.destroy({ children: true })
            resolve()
          }
        }
      }
      this.app.ticker.add(fn)
    })
  }

  resize(parentWidth: number) {
    const baseW = BOARD_W + 40
    const scale = Math.min(1, parentWidth / baseW)
    this.app.canvas.style.width = `${baseW * scale}px`
    this.app.canvas.style.height = `${(BOARD_H + 40) * scale}px`
  }

  setBonusTint(active: boolean) {
    this.board.tint = active ? 0xffe9b0 : 0xffffff
  }

  destroy() {
    this.destroyed = true
    if (this.spinTickerFn) this.app.ticker.remove(this.spinTickerFn)
    this.fxTickers.forEach((fn) => this.app.ticker?.remove(fn))
    try {
      this.app.destroy(true, { children: true })
    } catch {
      // ignore
    }
  }
}
