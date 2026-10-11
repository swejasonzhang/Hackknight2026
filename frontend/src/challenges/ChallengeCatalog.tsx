import { CHALLENGE_LIST, MUSCLES, type ChallengeId, type ChallengeRunDto } from '@arc/dependencies'
import { useId } from 'react'
import { Lamp, Tag } from '../components/ui'
import { factsOf } from './facts'

interface Props {
  /** The card pressed, or null while the page works out which. */
  value: ChallengeId | null
  onChange: (id: ChallengeId) => void
  /** The profile's challenge, marked on its card. */
  run?: ChallengeRunDto | null
  /** The detail the cards open. */
  controls?: string
}

/**
 * Every challenge as a card: its name and line, how long and how often, the level, and the muscle
 * groups it builds most. Each card is a toggle button, so Tab reaches it and Enter or Space picks
 * it; the one pressed is navy, like a pressed chip, and opens the detail.
 */
export function ChallengeCatalog({ value, onChange, run, controls }: Props) {
  const base = useId()
  return (
    <ul className="grid gap-3 md:grid-cols-2" aria-label="Challenges">
      {CHALLENGE_LIST.map((c) => {
        const pressed = c.id === value
        const status = run?.challengeId === c.id && run.status !== 'left' ? run.status : null
        const id = `${base}-${c.id}`
        return (
          <li key={c.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={pressed}
              aria-labelledby={`${id}-name`}
              aria-describedby={`${id}-about`}
              aria-controls={controls}
              onClick={() => onChange(c.id)}
              className={`flex h-full w-full cursor-pointer flex-col items-start gap-3 border p-4 text-left transition-colors ${pressed ? 'on-navy border-navy bg-navy shadow-[inset_0_3px_0_var(--cobalt)]' : 'border-rule bg-paper hover:border-navy'}`}
            >
              <span className="flex w-full items-start justify-between gap-3">
                <span id={`${id}-name`} className="min-w-0 font-display text-[17px] leading-[1.15] font-medium break-words text-ink">
                  {c.name}
                </span>
                {status && (
                  <span className="t-meta flex flex-none items-center gap-1.5 pt-0.5">
                    <Lamp tone={status === 'active' ? 'primary' : 'good'} />
                    {status === 'active' ? 'Yours' : 'Finished'}
                  </span>
                )}
              </span>
              <span id={`${id}-about`} className="flex flex-col gap-3">
                {status && <span className="sr-only">{status === 'active' ? 'Your challenge, under way.' : 'You finished it.'}</span>}
                <span className="t-desc">{c.tagline}</span>
                <span className="t-meta">{factsOf(c)}</span>
                <span className="flex flex-wrap gap-1.5">
                  {c.focus.map((m) => (
                    <Tag key={m} soft>
                      {MUSCLES[m].name}
                    </Tag>
                  ))}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
