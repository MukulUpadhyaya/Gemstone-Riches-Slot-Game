"use client"

import type { CheatMode } from "@/lib/slot/engine"
import { Sparkles, Gem, Crown } from "lucide-react"

interface CheatPanelProps {
  disabled: boolean
  onCheat: (mode: CheatMode) => void
}

const CHEATS: {
  mode: Exclude<CheatMode, null>
  label: string
  code: string
  icon: typeof Sparkles
}[] = [
  { mode: "bonus", label: "Trigger Bonus", code: "bonus", icon: Sparkles },
  { mode: "bigwin", label: "Big Win", code: "bigwin", icon: Gem },
  { mode: "megawin", label: "Mega Win", code: "megawin", icon: Crown },
]

export function CheatPanel({ disabled, onCheat }: CheatPanelProps) {
  return (
    <div className="mt-2 w-full rounded-xl bg-[var(--panel)] p-4 ring-1 ring-[var(--panel-ring)]">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        Cheat Codes — click or type the word
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CHEATS.map(({ mode, label, code, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => onCheat(mode)}
            className="flex flex-col items-center gap-1 rounded-lg bg-[var(--panel-hover)] px-2 py-3 text-center ring-1 ring-[var(--panel-ring)] transition hover:ring-[var(--gold)] disabled:opacity-40"
          >
            <Icon className="h-5 w-5 text-[var(--gold)]" />
            <span className="text-xs font-bold text-[var(--foreground)]">
              {label}
            </span>
            <kbd className="rounded bg-[var(--background)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
              {code}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  )
}
