"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SlotRenderer } from "@/lib/slot/renderer"
import { spin, bonusSpin, type CheatMode, type SpinResult } from "@/lib/slot/engine"
import { FREE_SPINS_AWARDED } from "@/lib/slot/config"
import { GameHud } from "@/components/game-hud"
import { CheatPanel } from "@/components/cheat-panel"
import { BonusBanner } from "@/components/bonus-banner"

const BET_STEPS = [10, 20, 50, 100, 200, 500]

export function SlotGame() {
  const canvasParentRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SlotRenderer | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [ready, setReady] = useState(false)
  const [balance, setBalance] = useState(10000)
  const [betIndex, setBetIndex] = useState(1)
  const [lastWin, setLastWin] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("Place your bet and spin!")

  const [freeSpins, setFreeSpins] = useState(0)
  const [inBonus, setInBonus] = useState(false)
  const [bonusTotal, setBonusTotal] = useState(0)
  const [showBonusIntro, setShowBonusIntro] = useState(false)

  const queuedCheat = useRef<CheatMode>(null)
  const bet = BET_STEPS[betIndex]

  // init pixi
  useEffect(() => {
    let mounted = true
    const renderer = new SlotRenderer()
    rendererRef.current = renderer
    if (canvasParentRef.current) {
      renderer.init(canvasParentRef.current).then(() => {
        if (!mounted) return
        setReady(true)
        if (wrapperRef.current) renderer.resize(wrapperRef.current.clientWidth)
      })
    }
    const onResize = () => {
      if (wrapperRef.current) renderer.resize(wrapperRef.current.clientWidth)
    }
    window.addEventListener("resize", onResize)
    return () => {
      mounted = false
      window.removeEventListener("resize", onResize)
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  const runResult = useCallback(
    async (result: SpinResult, betUsed: number, isFree: boolean) => {
      const renderer = rendererRef.current!
      await renderer.spin(result)

      if (result.totalWin > 0) {
        setLastWin(result.totalWin)
        setBalance((b) => b + result.totalWin)
        if (isFree) setBonusTotal((t) => t + result.totalWin)

        if (result.tier === "big" || result.tier === "mega") {
          await renderer.playWinCelebration(result.tier, result.totalWin)
        }
        setMessage(
          `${result.tier === "mega" ? "MEGA WIN! " : result.tier === "big" ? "BIG WIN! " : ""}You won ${result.totalWin.toLocaleString()}!`,
        )
      } else if (!isFree) {
        setMessage("No win — try again!")
      }

      return result
    },
    [],
  )

  const startBonus = useCallback(() => {
    setInBonus(true)
    setBonusTotal(0)
    setFreeSpins(FREE_SPINS_AWARDED)
    setShowBonusIntro(true)
    rendererRef.current?.setBonusTint(true)
  }, [])

  const doSpin = useCallback(async () => {
    if (busy || !ready) return
    const renderer = rendererRef.current
    if (!renderer) return

    // Bonus / free spin flow
    if (inBonus) {
      if (freeSpins <= 0) return
      setBusy(true)
      setLastWin(0)
      setFreeSpins((f) => f - 1)
      const result = bonusSpin(bet)
      await runResult(result, bet, true)
      // check if bonus over
      setFreeSpins((f) => {
        if (f <= 0) {
          // end bonus
          setTimeout(() => {
            setInBonus(false)
            renderer.setBonusTint(false)
            setMessage(`Bonus complete! Total bonus win this round.`)
          }, 400)
        }
        return f
      })
      setBusy(false)
      return
    }

    // normal spin
    if (balance < bet) {
      setMessage("Not enough balance!")
      return
    }
    setBusy(true)
    setLastWin(0)
    setBalance((b) => b - bet)
    setMessage("Spinning...")

    const cheat = queuedCheat.current
    queuedCheat.current = null
    const result = spin(bet, cheat)
    await runResult(result, bet, false)

    if (result.triggeredBonus) {
      setTimeout(() => startBonus(), 600)
    }
    setBusy(false)
  }, [busy, ready, inBonus, freeSpins, bet, balance, runResult, startBonus])

  const triggerCheat = useCallback(
    (mode: CheatMode) => {
      if (busy || inBonus) return
      queuedCheat.current = mode
      setMessage(
        mode === "bonus"
          ? "Cheat armed: BONUS — spinning!"
          : mode === "bigwin"
            ? "Cheat armed: BIG WIN — spinning!"
            : "Cheat armed: MEGA WIN — spinning!",
      )
      // auto-spin to reveal cheat
      setTimeout(() => doSpin(), 60)
    },
    [busy, inBonus, doSpin],
  )

  // keyboard cheat codes
  useEffect(() => {
    let buffer = ""
    let timer: ReturnType<typeof setTimeout>
    const codes: Record<string, CheatMode> = {
      bonus: "bonus",
      bigwin: "bigwin",
      megawin: "megawin",
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        buffer += e.key.toLowerCase()
        if (buffer.length > 12) buffer = buffer.slice(-12)
        for (const code in codes) {
          if (buffer.endsWith(code)) {
            triggerCheat(codes[code])
            buffer = ""
          }
        }
        clearTimeout(timer)
        timer = setTimeout(() => (buffer = ""), 1500)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      clearTimeout(timer)
    }
  }, [triggerCheat])

  const canSpin = inBonus ? freeSpins > 0 && !busy : !busy && balance >= bet

  return (
    <div
      ref={wrapperRef}
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-6"
    >
      <header className="text-center">
        <h1 className="font-heading text-3xl font-black tracking-tight text-[var(--gold)] text-balance">
          GEMS OF FORTUNE
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          5×3 reels · 10 paylines · free-spin bonus
        </p>
      </header>

      {inBonus && (
        <BonusBanner freeSpins={freeSpins} bonusTotal={bonusTotal} />
      )}

      <div className="relative w-full">
        <div
          ref={canvasParentRef}
          className="flex w-full justify-center"
          aria-label="Slot machine reels"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted-foreground)]">
            Loading reels…
          </div>
        )}
        {showBonusIntro && (
          <BonusBanner.Intro
            onDone={() => setShowBonusIntro(false)}
            spins={FREE_SPINS_AWARDED}
          />
        )}
      </div>

      <p
        aria-live="polite"
        className="min-h-6 text-center text-sm font-medium text-[var(--foreground)]"
      >
        {message}
      </p>

      <GameHud
        balance={balance}
        bet={bet}
        lastWin={lastWin}
        canSpin={canSpin}
        busy={busy}
        inBonus={inBonus}
        freeSpins={freeSpins}
        onSpin={doSpin}
        onBetChange={(dir) =>
          setBetIndex((i) =>
            Math.max(0, Math.min(BET_STEPS.length - 1, i + dir)),
          )
        }
      />

      <CheatPanel disabled={busy || inBonus} onCheat={triggerCheat} />
    </div>
  )
}
