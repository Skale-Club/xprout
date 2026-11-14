/** Five-slot position display shared by dish carousels; the active dash stays centered. */
export default function MorsePositionIndicator({ index, total, label, className = '', shadow = false }: {
  index: number; total: number; label: string; className?: string; shadow?: boolean
}) {
  return <div className={`relative h-2 w-20 shrink-0 overflow-hidden ${className}`} role="img" aria-label={label}>
    <div className="absolute inset-y-0 left-0 transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateX(${32 - index * 16}px)` }}>
      {Array.from({ length: total }, (_, i) => i).filter(i => Math.abs(i - index) <= 3).map(i => {
        const distance = Math.min(Math.abs(i - index), 3)
        return <span key={i} className="absolute top-px flex h-1.5 w-4 justify-center" style={{ left: i * 16 }}>
          <span className={`block h-1.5 rounded-full bg-current transition-all duration-300 motion-reduce:transition-none ${shadow ? 'shadow-[1px_1px_2px_rgb(0_0_0/0.35)]' : ''}`}
            style={{ width: distance === 0 ? 14 : 6, opacity: [1, 0.55, 0.25, 0][distance], transform: distance === 2 ? 'scale(0.75)' : distance === 3 ? 'scale(0.4)' : undefined }} />
        </span>
      })}
    </div>
  </div>
}
