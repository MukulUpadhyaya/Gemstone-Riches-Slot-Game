"use client"

import { Minus, Plus, Loader2 } from "lucide-react"

interface GameHudProps {
  balance: number
  bet: number
  lastWin: number
  canSpin: boolean
  busy: boolean
  inBonus: boolean
  freeSpins: number
  onSpin: () => void
  onBetChange: (dir: number) => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-[var(--panel)] px-4 py-2 ring-1 ring-[var(--panel-ring)]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="font-mono text-lg font-bold text-[var(--gold)]">
        {value}
      </span>
    </div>
  )
}

export function GameHud({
  balance,
  bet,
  lastWin,
  canSpin,
  busy,
  inBonus,
  freeSpins,
  onSpin,
  onBetChange,
}: GameHudProps) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="grid w-full grid-cols-3 gap-3">
        <Stat label="Balance" value={balance.toLocaleString()} />
        <Stat label="Last Win" value={lastWin.toLocaleString()} />
        <Stat
          label={inBonus ? "Free Spins" : "Bet"}
          value={inBonus ? String(freeSpins) : bet.toLocaleString()}
        />
      </div>

      <div className="flex w-full items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Decrease bet"
          disabled={inBonus || busy}
          onClick={() => onBetChange(-1)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--panel)] text-[var(--foreground)] ring-1 ring-[var(--panel-ring)] transition hover:bg-[var(--panel-hover)] disabled:opacity-40"
        >
          <Minus className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onSpin}
          disabled={!canSpin}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-[var(--gold)] to-[var(--gold-deep)] font-black uppercase tracking-wide text-[#2a1500] shadow-lg shadow-[var(--gold-deep)]/40 ring-2 ring-[#fff4cc] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : inBonus ? (
            "FREE"
          ) : (
            "SPIN"
          )}
        </button>

        <button
          type="button"
          aria-label="Increase bet"
          disabled={inBonus || busy}
          onClick={() => onBetChange(1)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--panel)] text-[var(--foreground)] ring-1 ring-[var(--panel-ring)] transition hover:bg-[var(--panel-hover)] disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
