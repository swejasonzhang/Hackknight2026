import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

/** A Radix tooltip on any element. Wrap the app once in `HintProvider`. */
export function Hint({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={8} className="z-50 max-w-[260px] rounded-[12px] border border-primary/30 bg-surface px-3 py-2 text-[12.5px] leading-snug text-ink shadow-[0_0_24px_rgb(0_161_255/0.35)]">
          {label}
          <Tooltip.Arrow className="fill-surface" width={12} height={6} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function HintProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>
}
