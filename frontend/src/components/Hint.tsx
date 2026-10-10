import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

/** A Radix tooltip drawn as a mono note on paper. Wrap the app once in `HintProvider`. */
export function Hint({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={8} className="z-50 max-w-[260px] border border-rule-strong bg-paper px-3 py-2 font-mono text-[12px] leading-snug text-ink">
          {label}
          <Tooltip.Arrow className="fill-rule-strong" width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function HintProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>
}
