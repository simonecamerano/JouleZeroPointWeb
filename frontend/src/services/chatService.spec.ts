import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../stores/auth'
import { chatService } from './chatService'

/**
 * Builds a structurally valid, non-expired JWT.
 *
 * setAuth rejects anything isJwtExpired flags, and that check treats a token
 * without three dot-separated parts, or without a future numeric exp, as
 * expired. A placeholder string like 'jwt-token' is therefore discarded and the
 * store stays empty, which is the store defending itself correctly rather than a
 * bug: the test has to hand it a token of the shape it accepts.
 */
function makeValidJwt( secondsFromNow = 3600 ) {
  const encode = ( obj: object ) => btoa( JSON.stringify( obj ) )
    .replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' )
  const exp = Math.floor( Date.now() / 1000 ) + secondsFromNow
  return `${encode( { alg: 'HS256', typ: 'JWT' } )}.${encode( { exp } )}.signature`
}

describe( 'chatService', () => {
  beforeEach( () => {
    setActivePinia( createPinia() )
    localStorage.clear()
    vi.clearAllMocks()
  } )

  it( 'sends the bearer token when the user is authenticated', async () => {
    const token = makeValidJwt()
    const authStore = useAuthStore()
    authStore.setAuth( token, 'simone' )

    const fetchMock = vi.fn().mockResolvedValue( {
      ok: false,
      status: 500,
    } )
    vi.stubGlobal( 'fetch', fetchMock )

    await chatService.streamChat(
      'stato della partita',
      null,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )

    expect( fetchMock ).toHaveBeenCalledWith(
      '/api/v1/terminal/chat',
      expect.objectContaining( {
        headers: expect.objectContaining( {
          Authorization: `Bearer ${token}`,
          'x-user': 'simone',
        } ),
      } ),
    )
  } )

  it( 'does not authenticate with an expired token', async () => {
    const authStore = useAuthStore()
    authStore.setAuth( makeValidJwt( -60 ), 'simone' )

    const fetchMock = vi.fn().mockResolvedValue( { ok: false, status: 500 } )
    vi.stubGlobal( 'fetch', fetchMock )

    await chatService.streamChat( 'stato della partita', null, vi.fn(), vi.fn(), vi.fn() )

    const [, options] = fetchMock.mock.calls[0]
    expect( options.headers ).not.toHaveProperty( 'Authorization' )
  } )

  it( 'keeps anonymous terminal requests anonymous', async () => {
    const fetchMock = vi.fn().mockResolvedValue( {
      ok: false,
      status: 500,
    } )
    vi.stubGlobal( 'fetch', fetchMock )

    await chatService.streamChat(
      'ciao',
      null,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )

    const [, options] = fetchMock.mock.calls[0]
    expect( options.headers ).not.toHaveProperty( 'Authorization' )
    expect( options.headers ).toMatchObject( {
      'Content-Type': 'application/json',
      'x-user': '',
    } )
  } )
} )
