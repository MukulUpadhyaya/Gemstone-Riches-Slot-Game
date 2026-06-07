import { SlotGame } from "@/components/slot-game"

export default function Page() {
  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-[var(--casino-bg)]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url(/bg.png)" }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        <SlotGame />
      </div>
    </main>
  )
}
