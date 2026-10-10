import * as RS from '@radix-ui/react-select'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** Lets a `<label htmlFor>` name the control. */
  id?: string
  'aria-label'?: string
  /** `field` sits in a datasheet like an input; `readout` is the underlined mono switcher. */
  variant?: 'field' | 'readout'
  disabled?: boolean
  className?: string
}

/**
 * The dropdown on the Calibre system, built on Radix Select: a square trigger (an input in a
 * datasheet, or an underlined mono readout), and a paper list with a navy hairline where the
 * highlighted option takes the cobalt edge and the chosen one a cobalt square. Keyboard,
 * typeahead and screen-reader behaviour come from Radix.
 */
export function Select<T extends string>({ value, options, onChange, id, variant = 'field', disabled, className = '', ...rest }: Props<T>) {
  return (
    <RS.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RS.Trigger id={id} aria-label={rest['aria-label']} className={`${variant === 'field' ? 'input select-trigger' : 'select-readout'} ${className}`.trim()}>
        <span className="min-w-0 truncate">
          <RS.Value />
        </span>
        <RS.Icon className="select-chevron">
          <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
            <path d="M0 0h10L5 6z" fill="currentColor" />
          </svg>
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content position="popper" sideOffset={4} collisionPadding={12} className="select-content" data-variant={variant}>
          <RS.Viewport className="select-viewport">
            {options.map((o) => (
              <RS.Item key={o.value} value={o.value} className="select-item">
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator className="select-check" />
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  )
}
