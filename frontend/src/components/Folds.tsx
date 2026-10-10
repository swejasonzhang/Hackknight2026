import * as Accordion from '@radix-ui/react-accordion'
import { useState, type ReactNode } from 'react'

export interface FoldItem {
  id: string
  index: string
  title: string
  /** The reading shown on the folded row, so a closed chart still says something. */
  summary?: ReactNode
  /** A note shown above the chart once it is open. */
  aside?: string
  /** Rendered only while open, so a chart draws itself in each time it unfolds. */
  render: () => ReactNode
}

/**
 * A ruled stack of folded charts: each row is an index, a title, its latest reading and a plus;
 * pressing the row unfolds the chart beneath it. Several can be open at once, and one control
 * opens or closes them all.
 */
export function Folds({ items, label }: { items: FoldItem[]; label: string }) {
  const [open, setOpen] = useState<string[]>([])
  const allOpen = open.length === items.length

  return (
    <div>
      <div className="flex items-center justify-between gap-4 pb-3">
        <span className="t-meta">
          {label} · {items.length}
        </span>
        <button type="button" className="btn btn-ghost t-label" onClick={() => setOpen(allOpen ? [] : items.map((i) => i.id))}>
          {allOpen ? 'Close all' : 'Open all'}
        </button>
      </div>
      <Accordion.Root type="multiple" value={open} onValueChange={setOpen} className="border-t border-rule-strong">
        {items.map((item) => (
          <Accordion.Item key={item.id} value={item.id} className="border-b border-rule">
            <Accordion.Header className="m-0">
              <Accordion.Trigger className="group grid w-full cursor-pointer grid-cols-[36px_minmax(0,1fr)_32px] items-center gap-x-3 py-4 text-left sm:grid-cols-[44px_minmax(0,1fr)_auto_32px] sm:gap-x-5">
                <span className="strip-index self-center">{item.index}</span>
                <span className="t-strip min-w-0 transition-colors group-hover:text-cobalt">{item.title}</span>
                {item.summary != null && <span className="t-meta col-start-2 row-start-2 mt-1 text-ink-2 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:text-right">{item.summary}</span>}
                <span
                  aria-hidden="true"
                  className="col-start-3 row-span-2 row-start-1 inline-flex h-8 w-8 items-center justify-center self-center border border-rule-strong font-mono text-[16px] leading-none text-navy transition-colors group-hover:border-navy group-data-[state=open]:border-navy group-data-[state=open]:bg-navy group-data-[state=open]:text-white sm:col-start-4 sm:row-span-1"
                >
                  <span className="transition-transform duration-200 group-data-[state=open]:rotate-90 group-data-[state=open]:hidden">+</span>
                  <span className="hidden group-data-[state=open]:inline">−</span>
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="fold-content overflow-hidden">
              <div className="pb-6 sm:pl-[64px]">
                {item.aside && <p className="t-meta mb-3">{item.aside}</p>}
                {item.render()}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  )
}
