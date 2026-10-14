import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../utils/api'

const AUTH_STORAGE_KEYS = ['token', 'username', 'email', 'isAdmin', 'joule-terminal-session']

type PersistedAuth = {
  token: string | null
  username: string
  email: string
  isAdmin: boolean
}

function decodeJwtPayload( token: string ) {
  const payload = token.split( '.' )[1]
  const normalizedPayload = payload.replace( /-/g, '+' ).replace( /_/g, '/' )
  const paddedPayload = normalizedPayload.padEnd( normalizedPayload.length + ( 4 - normalizedPayload.length % 4 ) % 4, '=' )
  return JSON.parse( atob( paddedPayload ) ) as { exp?: number }
}

export function isJwtExpired( token: string | null, now = Date.now() ) {
  if ( !token ) return false

  const parts = token.split( '.' )
  if ( parts.length !== 3 ) return true

  try {
    const payload = decodeJwtPayload( token )
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= now
  } catch {
    return true
  }
}

function clearAuthPersistence() {
  AUTH_STORAGE_KEYS.forEach( ( key ) => localStorage.removeItem( key ) )
}

function readPersistedAuth(): PersistedAuth {
  const persistedToken = localStorage.getItem( 'token' )

  if ( isJwtExpired( persistedToken ) ) {
    clearAuthPersistence()
    return { token: null, username: '', email: '', isAdmin: false }
  }

  return {
    token: persistedToken,
    username: localStorage.getItem( 'username' ) || '',
    email: localStorage.getItem( 'email' ) || '',
    isAdmin: localStorage.getItem( 'isAdmin' ) === 'true',
  }
}

function isProtectedPath() {
  if ( typeof window === 'undefined' ) return false

  return ['/admin', '/deckbuilder', '/profile', '/partita'].some( ( path ) => window.location.pathname.startsWith( path ) )
}

/**
 * Authentication Store for Joule: Zero Point.
 * Handles user session state, token persistence, and login/logout logic.
 */
export const useAuthStore = defineStore( 'auth', () => {
  const persistedAuth = readPersistedAuth()
  let expiryTimer: ReturnType<typeof setTimeout> | null = null

  // State: Initialized from localStorage to maintain session across refreshes
  const token = ref( persistedAuth.token )
  const username = ref( persistedAuth.username )
  const email = ref( persistedAuth.email )
  const isAdmin = ref( persistedAuth.isAdmin )

  /**
   * Computed property to check if a user is currently authenticated.
   */
  const isLoggedIn = computed( () => !!token.value )

  function clearSession() {
    token.value = null
    username.value = ''
    email.value = ''
    isAdmin.value = false
    clearAuthPersistence()

    if ( expiryTimer ) {
      clearTimeout( expiryTimer )
      expiryTimer = null
    }
  }

  function scheduleTokenExpiry( currentToken: string | null ) {
    if ( expiryTimer ) {
      clearTimeout( expiryTimer )
      expiryTimer = null
    }

    if ( !currentToken || isJwtExpired( currentToken ) ) return

    try {
      const payload = decodeJwtPayload( currentToken )
      if ( typeof payload.exp !== 'number' ) return

      const delay = payload.exp * 1000 - Date.now()
      if ( delay > 0 ) {
        expiryTimer = setTimeout( () => {
          clearSession()

          if ( isProtectedPath() ) {
            window.location.href = '/login?session_expired=1'
          }
        }, delay )
      }
    } catch {
      clearSession()
    }
  }

  /**
   * Updates the authentication state and persists credentials to localStorage.
   */
  function setAuth( newToken: string, newUsername: string, newIsAdmin: boolean = false, newEmail: string = '' ) {
    if ( isJwtExpired( newToken ) ) {
      clearSession()
      return
    }

    token.value = newToken
    username.value = newUsername
    email.value = newEmail
    isAdmin.value = newIsAdmin
    localStorage.setItem( 'token', newToken )
    localStorage.setItem( 'username', newUsername )
    localStorage.setItem( 'email', newEmail )
    localStorage.setItem( 'isAdmin', String( newIsAdmin ) )
    scheduleTokenExpiry( newToken )
  }

  /**
   * Clears the current session and removes credentials from persistence layers.
   */
  async function logout() {
    try {
      if ( token.value ) {
        await api.post( '/auth/logout' )
      }
    } catch ( error ) {
      console.warn( 'Logout protocol dissonance (Backend already cleared or unreachable):', error )
    } finally {
      clearSession()
    }
  }

  /**
   * Synchronizes profile updates with the backend and local state.
   */
  async function updateProfile( data: { username?: string, password?: string } ) {
    const response = await api.put( '/auth/profile', data )
    const { token: newToken, username: newUsername, isAdmin: newIsAdmin, email: newEmail } = response.data
    setAuth( newToken, newUsername, !!newIsAdmin, newEmail )
    return response.data
  }

  /**
   * Protocol: Trigger Passphrase Recovery
   * Requests a reset link via email using the established security pathway.
   */
  async function requestPasswordReset( emailValue: string ) {
    await api.post( '/auth/forgot-password', { email: emailValue } )
    return true
  }

  /**
   * Synchronizes the internal state with the browser's persistent storage.
   */
  function initialize() {
    const nextAuth = readPersistedAuth()
    token.value = nextAuth.token
    username.value = nextAuth.username
    email.value = nextAuth.email
    isAdmin.value = nextAuth.isAdmin
    scheduleTokenExpiry( nextAuth.token )
  }

  scheduleTokenExpiry( token.value )

  return { token, username, email, isLoggedIn, isAdmin, setAuth, logout, updateProfile, requestPasswordReset, initialize, clearSession }
} )
