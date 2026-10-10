import type {
  AskInput,
  AuthResponse,
  CoachMessageDto,
  CoachStatus,
  OnboardingInput,
  OnboardingReply,
  SetFeedbackInput,
  CreateSessionInput,
  CreateProfileInput,
  DeleteAccountInput,
  ExerciseId,
  LeaderboardDto,
  LeaderboardWindow,
  LoginInput,
  PlanDto,
  PlanInput,
  ProgramDto,
  ProgramEdit,
  ProfileDto,
  ProgressDto,
  SessionDto,
  SignupInput,
  UpdatePlanInput,
  UserDto,
} from '@arc/dependencies'
import { getToken, signOutLocally } from '../auth/token'

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
    /** Needs the account's own email and password again; answers 204 and the token stops working. */
    deleteAccount: (input: DeleteAccountInput) => request<null>('/api/auth/account/delete', { method: 'POST', body: input }),
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
    /** The week Arc built: training days and what each holds (404 until Arc has built one). */
    program: (profileId: string) => request<ProgramDto>(`/api/profiles/${profileId}/program`),
    /** Every week the profile has had, newest first. */
    programs: (profileId: string) => request<ProgramDto[]>(`/api/profiles/${profileId}/programs`),
    /** The member's own week: it becomes the active one, and Arc writes its summary. */
    putProgram: (profileId: string, input: ProgramEdit) => request<ProgramDto>(`/api/profiles/${profileId}/program`, { method: 'PUT', body: input }),
  },
  /** The household leaderboard: the account's profiles ranked on a window's training. */
  leaderboard: (window: LeaderboardWindow = 'week') => request<LeaderboardDto>(`/api/leaderboard?window=${window}`),
  sessions: {
    list: (profileId: string, exercise?: ExerciseId) =>
      request<SessionDto[]>(`/api/profiles/${profileId}/sessions${exercise ? `?exercise=${exercise}` : ''}`),
    get: (id: string) => request<SessionDto>(`/api/sessions/${id}`),
    /** A session recorded in the browser, saved as the signed-in user (the server recomputes fatigue and the summary). */
    create: (input: CreateSessionInput) => request<SessionDto>('/api/sessions', { method: 'POST', body: input }),
    /** A recording saved as it goes: every set so far, `complete` at the end. */
    update: (id: string, input: CreateSessionInput) => request<SessionDto>(`/api/sessions/${id}`, { method: 'PUT', body: input }),
  },
  progress: (profileId: string, exercise: ExerciseId) =>
    request<ProgressDto>(`/api/profiles/${profileId}/progress?exercise=${exercise}`),
  /** Arc, the coach: onboarding chat, reads after a set and a session, and Arc's voice. */
  coach: {
    status: () => request<CoachStatus>('/api/coach/status'),
    onboarding: (input: OnboardingInput) => request<OnboardingReply>('/api/coach/onboarding', { method: 'POST', body: input }),
    setFeedback: (input: SetFeedbackInput) => request<CoachMessageDto>('/api/coach/sets', { method: 'POST', body: input }),
    summary: (sessionId: string) => request<CoachMessageDto>(`/api/coach/sessions/${sessionId}/summary`, { method: 'POST' }),
    /** Arc's line as MP3 (ElevenLabs), fetched with the member's token. */
    audio: async (messageId: string): Promise<Blob> => {
      const token = getToken()
      const res = await fetch(`/api/coach/messages/${messageId}/audio`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new ApiRequestError(res.status, `HTTP ${res.status}`)
      return res.blob()
    },
    /** Arc's voice for a short line that is not stored: an acknowledgement, a cue during a set. */
    speak: async (text: string): Promise<Blob> => {
      const token = getToken()
      const res = await fetch('/api/coach/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new ApiRequestError(res.status, `HTTP ${res.status}`)
      return res.blob()
    },
    /** Something the member said to Arc mid-workout; Arc's answer comes back as a stored message. */
    ask: (input: AskInput) => request<CoachMessageDto>('/api/coach/ask', { method: 'POST', body: input }),
  },
  dev: {
    seed: () => request<SeedResult>('/api/dev/seed', { method: 'POST', body: { tzOffsetMinutes: new Date().getTimezoneOffset() } }),
  },
}
