import type {
  AuthResponse,
  CreateProfileInput,
  ExerciseId,
  LoginInput,
  PlanDto,
  PlanInput,
  ProfileDto,
  ProgressDto,
  SessionDto,
  SignupInput,
  UpdatePlanInput,
  UserDto,
} from '@arc/dependencies'
import { getToken, signOutLocally } from '../auth/token'
import { subscribe, type StreamHandlers } from './sse'

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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const hasBody = init.body !== undefined
  const token = getToken()
  const headers: Record<string, string> = {}
  if (hasBody) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetch(path, { method: init.method ?? 'GET', headers, body: hasBody ? JSON.stringify(init.body) : undefined })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    if (res.status === 401 && token) signOutLocally()
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
  auth: {
    signup: (input: SignupInput) => request<AuthResponse>('/api/auth/signup', { method: 'POST', body: input }),
    login: (input: LoginInput) => request<AuthResponse>('/api/auth/login', { method: 'POST', body: input }),
    me: () => request<UserDto>('/api/auth/me'),
  },
  profiles: {
    list: () => request<ProfileDto[]>('/api/profiles'),
    get: (id: string) => request<ProfileDto>(`/api/profiles/${id}`),
    create: (input: CreateProfileInput) => request<ProfileDto>('/api/profiles', { method: 'POST', body: input }),
    delete: (id: string) => request<void>(`/api/profiles/${id}`, { method: 'DELETE' }),
  },
  plan: {
    get: (profileId: string) => request<PlanDto>(`/api/profiles/${profileId}/plan`),
    history: (profileId: string) => request<PlanDto[]>(`/api/profiles/${profileId}/plans`),
    put: (profileId: string, input: PlanInput) => request<PlanDto>(`/api/profiles/${profileId}/plan`, { method: 'PUT', body: input }),
    patch: (profileId: string, input: UpdatePlanInput) =>
      request<PlanDto>(`/api/profiles/${profileId}/plan`, { method: 'PATCH', body: input }),
  },
  sessions: {
    list: (profileId: string, exercise?: ExerciseId) =>
      request<SessionDto[]>(`/api/profiles/${profileId}/sessions${exercise ? `?exercise=${exercise}` : ''}`),
    get: (id: string) => request<SessionDto>(`/api/sessions/${id}`),
    /** Live feed of sessions stored for a profile (Server-Sent Events). Returns the unsubscribe function. */
    stream: (profileId: string, handlers: StreamHandlers) => subscribe(`/api/profiles/${profileId}/stream`, handlers),
  },
  progress: (profileId: string, exercise: ExerciseId) =>
    request<ProgressDto>(`/api/profiles/${profileId}/progress?exercise=${exercise}`),
  dev: {
    seed: () => request<SeedResult>('/api/dev/seed', { method: 'POST' }),
  },
}
