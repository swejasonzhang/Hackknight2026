import type {
  CreateProfileInput,
  CreateSessionInput,
  ExerciseId,
  ProfileDto,
  PlanDto,
  PlanInput,
  ProgressDto,
  SessionDto,
  UpdatePlanInput,
} from '@ptg/dependencies'

export class ApiRequestError extends Error {
  readonly status: number
  readonly issues: unknown

  constructor(status: number, message: string, issues?: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.issues = issues
  }
}

interface RequestInit2 {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

async function request<T>(path: string, init: RequestInit2 = {}): Promise<T> {
  const hasBody = init.body !== undefined
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: hasBody ? { 'content-type': 'application/json' } : {},
    body: hasBody ? JSON.stringify(init.body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: unknown; issues?: unknown }
    const message = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`
    throw new ApiRequestError(res.status, message, body.issues)
  }
  return data as T
}

export interface SeedResult {
  profileId: string
  sessions: number
  created: boolean
}

/** Typed wrapper over the REST API. Every path matches a route in backend/src/routes. */
export const api = {
  health: () => request<{ ok: boolean; db: string }>('/api/health'),
  profiles: {
    list: () => request<ProfileDto[]>('/api/profiles'),
    get: (id: string) => request<ProfileDto>(`/api/profiles/${id}`),
    create: (input: CreateProfileInput) => request<ProfileDto>('/api/profiles', { method: 'POST', body: input }),
  },
  plan: {
    get: (profileId: string) => request<PlanDto>(`/api/profiles/${profileId}/plan`),
    history: (profileId: string) => request<PlanDto[]>(`/api/profiles/${profileId}/plans`),
    put: (profileId: string, input: PlanInput) => request<PlanDto>(`/api/profiles/${profileId}/plan`, { method: 'PUT', body: input }),
    patch: (profileId: string, input: UpdatePlanInput) =>
      request<PlanDto>(`/api/profiles/${profileId}/plan`, { method: 'PATCH', body: input }),
  },
  sessions: {
    create: (input: CreateSessionInput) => request<SessionDto>('/api/sessions', { method: 'POST', body: input }),
    list: (profileId: string, exercise?: ExerciseId) =>
      request<SessionDto[]>(`/api/profiles/${profileId}/sessions${exercise ? `?exercise=${exercise}` : ''}`),
    get: (id: string) => request<SessionDto>(`/api/sessions/${id}`),
  },
  progress: (profileId: string, exercise: ExerciseId) =>
    request<ProgressDto>(`/api/profiles/${profileId}/progress?exercise=${exercise}`),
  dev: {
    seed: () => request<SeedResult>('/api/dev/seed', { method: 'POST' }),
  },
}
