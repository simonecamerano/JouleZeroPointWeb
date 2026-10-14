import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const handlers: Record<string, ( ...a: unknown[] ) => void> = {}
const emit = vi.fn()
const fakeSocket = {
  on: vi.fn( ( ev: string, fn: ( ...a: unknown[] ) => void ) => { handlers[ev] = fn } ),
  emit,
  disconnect: vi.fn(),
  connected: true,
}
vi.mock( 'socket.io-client', () => ( { io: vi.fn( () => fakeSocket ) } ) )
vi.mock( './auth', () => ( { useAuthStore: () => ( { token: 'jwt-di-prova' } ) } ) )

import { io } from 'socket.io-client'
import { useMatchStore } from './matchStore'
import type { Aggiornamento } from '../types/match'

function aggiornamento( over: Partial<Aggiornamento> = {} ): Aggiornamento {
  return {
    codice: 'COD', statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob', scadenzaFinestra: null,
    mosse: [
      { tipo: 'passaTurno' },
      { tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' },
      { tipo: 'giocaCarta', uid: 'A-1', colonna: 'passato' },
      { tipo: 'scambio', uid: 'A-1' },
      { tipo: 'giocaCarta', uid: 'A-2' },
    ],
    vista: { io: 'A', tocca: 'A' } as Aggiornamento['vista'],
    ...over,
  }
}

describe( 'matchStore', () => {
  beforeEach( () => {
    setActivePinia( createPinia() )
    emit.mockReset()
    vi.mocked( io ).mockClear()
  } )

  it( 'connette il socket con il token JWT, senza forzare i transport', () => {
    useMatchStore().connetti()
    expect( io ).toHaveBeenCalledWith( { path: '/socket.io', auth: { token: 'jwt-di-prova' } } )
  } )

  it( 'salva l aggiornamento ricevuto e calcola tocca', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    expect( s.agg?.codice ).toBe( 'COD' )
    expect( s.tocca ).toBe( true )
  } )

  it( 'colonneGiocabili segue la carta selezionata', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    s.seleziona( 'A-1' )
    expect( s.colonneGiocabili ).toEqual( ['presente', 'passato'] )
    expect( s.mosseDi( 'A-1' ) ).toHaveLength( 3 )
    s.seleziona( 'A-9' )
    expect( s.colonneGiocabili ).toEqual( [] )
  } )

  it( 'invia un azione con il codice corrente e riporta l errore dell ack', async () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    emit.mockImplementation( ( _ev, _d, ack ) => ack( { ok: false, errore: 'Non tocca a te' } ) )
    expect( await s.invia( { tipo: 'passaTurno' } ) ).toBe( false )
    expect( emit ).toHaveBeenCalledWith( 'partita:azione', { codice: 'COD', azione: { tipo: 'passaTurno' } }, expect.any( Function ) )
    expect( s.errore ).toBe( 'Non tocca a te' )
  } )

  it( 'dopo una mossa riuscita la selezione si azzera', async () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    s.seleziona( 'A-1' )
    emit.mockImplementation( ( _ev, _d, ack ) => ack( { ok: true } ) )
    expect( await s.invia( { tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' } ) ).toBe( true )
    expect( s.selezionata ).toBeNull()
    expect( s.errore ).toBeNull()
  } )

  it( 'crea restituisce il codice', async () => {
    const s = useMatchStore()
    s.connetti()
    emit.mockImplementation( ( _ev, _d, ack ) => ack( { ok: true, codice: 'NUOVO' } ) )
    expect( await s.crea( 'deck1' ) ).toBe( 'NUOVO' )
  } )

  it( 'connect_error espone il messaggio', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['connect_error']( new Error( 'Non autenticato' ) )
    expect( s.errore ).toBe( 'Non autenticato' )
    expect( s.connesso ).toBe( false )
  } )

  it( 'alla riconnessione rifa partita:entra col codice corrente', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['partita:aggiornamento']( aggiornamento() )
    emit.mockClear()
    handlers['connect']()
    expect( s.connesso ).toBe( true )
    expect( emit ).toHaveBeenCalledWith( 'partita:entra', { codice: 'COD' }, expect.any( Function ) )
  } )

  it( 'alla prima connessione, senza partita, non emette partita:entra', () => {
    const s = useMatchStore()
    s.connetti()
    handlers['connect']()
    expect( emit ).not.toHaveBeenCalled()
  } )
} )
