import type { CreateSessionInput } from '@arc/dependencies'

interface SessionApi {
  create(input: CreateSessionInput): Promise<{ id: string }>
  update(id: string, input: CreateSessionInput): Promise<{ id: string }>
}

/**
 * Saves a recording to MongoDB as it goes: the first save creates the session, every later save
 * replaces it with all the sets so far (the last one marks it complete). Saves run one after
 * another, so a quick second set never makes a second session, and a save that fails is made up
 * by the next, which carries everything recorded so far.
 */
export class SessionSaver {
  private id: string | null = null
  private chain: Promise<unknown> = Promise.resolve()
  private readonly api: SessionApi

  constructor(api: SessionApi) {
    this.api = api
  }

  /** The session's id once MongoDB has it. */
  get savedId(): string | null {
    return this.id
  }

  save(input: CreateSessionInput): Promise<string> {
    const run = this.chain
      .catch(() => {})
      .then(async () => {
        if (this.id) {
          await this.api.update(this.id, input)
          return this.id
        }
        this.id = (await this.api.create(input)).id
        return this.id
      })
    this.chain = run
    return run
  }
}
