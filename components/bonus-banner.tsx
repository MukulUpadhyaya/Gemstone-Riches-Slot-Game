"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

interface BonusBannerProps {
  freeSpins: number
  bonusTotal: number
}

export function BonusBanner({ freeSpins, bonusTotal }: BonusBannerProps) {
  return (
    <div className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-[var(--gold-deep)] to-[var(--gold)] px-5 py-3 text-[#2a1500] shadow-lg">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5" />
        <span className="font-black uppercase tracking-wide">Bonus Round</span>
      </div>
      <div className="flex gap-6 font-bold">
        <span>
          Free Spins: <span className="font-mono">{freeSpins}</span>
        </span>
        <span>
          Won: <span className="font-mono">{bonusTotal.toLocaleString()}</span>
        </span>
      </div>
    </div>
  )
}

function Intro({ onDone, spins }: { onDone: () => void; spins: number }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => {
      setShow(false)
      setTimeout(onDone, 400)
    }, 2400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="animate-bounce">
        <Sparkles className="h-14 w-14 text-[var(--gold)]" />
      </div>
      <h2 className="mt-3 text-4xl font-black tracking-tight text-[var(--gold)]">
        BONUS TRIGGERED!
      </h2>
      <p className="mt-1 text-lg font-bold text-white">
        {spins} Free Spins Awarded
      </p>
    </div>
  )
}

BonusBanner.Intro = Intro
