const KEY = 'arc.token'

/** Fired on `window` when the API rejects the stored token, so the app can show the sign-in pages. */
export const SIGNED_OUT_EVENT = 'arc:signed-out'

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    /* private mode: the session lasts until reload */
  }
}

/** Signing out forgets the token, and whose profile the browser was showing (the next account's may not have it). */
export function clearToken(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem('arc.selectedProfileId')
  } catch {
    /* nothing stored */
  }
}

/** Forget the token and tell the app. Used by the API client on a 401. */
export function signOutLocally(): void {
  clearToken()
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
}
