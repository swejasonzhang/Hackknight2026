import { useAuth } from '../../auth/AuthContext'

export interface AccountLink {
  to: string
  label: string
  /** The first link is the primary action and takes the block button. */
  primary: boolean
}

/**
 * The landing page's account actions. A visitor is invited to create an account or log in; a
 * signed-in user (who reached the landing from the app's logo) gets a way back in instead.
 */
export function useAccountLinks(): AccountLink[] {
  const { status } = useAuth()
  if (status === 'signedOut') {
    return [
      { to: '/signup', label: 'Create account', primary: true },
      { to: '/login', label: 'Log in', primary: false },
    ]
  }
  return [
    { to: '/dashboard', label: 'Open dashboard', primary: true },
    { to: '/profiles', label: 'Profiles', primary: false },
  ]
}
