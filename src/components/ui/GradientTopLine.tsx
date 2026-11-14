/**
 * The thin brand-gradient line on top of a prominent dark card (the sign-in
 * popup), with a soft wine glow under it. The parent must be positioned and clip
 * its overflow (rounded corners).
 */
export default function GradientTopLine({ glow = true }: { glow?: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 z-20 h-px bg-[linear-gradient(90deg,transparent,var(--platform-brand-accent)_38%,var(--platform-brand-secondary)_68%,transparent)]"
      />
      {glow ? (
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 z-0 h-24 w-48 -translate-x-1/2 rounded-full bg-platform-brand-accent/10 blur-3xl" />
      ) : null}
    </>
  )
}
