import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from './auth'
import type { Aggiornamento, Azione, Colonna } from '../types/match'

export type PartitaAperta = { codice: string; statoTavolo: 'attesa' | 'inCorso' | 'pausa' | 'terminata' }
type Risposta = { ok: boolean; errore?: string; codice?: string; ruolo?: string; codici?: string[]; partite?: PartitaAperta[] }

export const useMatchStore = defineStore( 'match', () => {
  const agg = ref<Aggiornamento | null>( null )
  const connesso = ref( false )
  const errore = ref<string | null>( null )
  const selezionata = ref<string | null>( null )
  const anteprima = ref<{ cardId: number; uid: string | null } | null>( null )
  let socket: Socket | null = null

  const vista = computed( () => agg.value?.vista ?? null )
  const tocca = computed( () => !!agg.value && !!vista.value && vista.value.tocca === agg.value.ruolo )

  function mosseDi( uid: string ): Azione[] {
    return ( agg.value?.mosse ?? [] ).filter( ( m ) => ( m.tipo === 'giocaCarta' || m.tipo === 'scambio' ) && m.uid === uid )
  }

  function mosseEffetto( uid: string ): Azione[] {
    return ( agg.value?.mosse ?? [] ).filter( ( m ) => ( m.tipo === 'attivaEffetto' || m.tipo === 'usaEffetto' ) && m.uid === uid )
  }

  // Bersagli validi della scelta in corso, solo per chi sceglie.
  const bersagli = computed<string[]>( () => {
    const d = vista.value?.decisione
    return tocca.value && d?.tipo === 'sceltaEffetto' && d.domanda?.tipo === 'bersaglio' ? d.domanda.uids : []
  } )

  function mostraAnteprima( cardId: number | null, uid: string | null = null ) {
    anteprima.value = cardId === null ? null : { cardId, uid }
  }

  const colonneGiocabili = computed<Colonna[]>( () => {
    if ( !selezionata.value ) return []
    return mosseDi( selezionata.value )
      .flatMap( ( m ) => ( m.tipo === 'giocaCarta' && m.colonna ? [m.colonna] : [] ) )
  } )

  function connetti() {
    if ( socket ) return
    const auth = useAuthStore()
    // Niente opzione `transports`: il default (polling poi upgrade a WebSocket) funge anche da fallback.
    socket = io( { path: '/socket.io', auth: { token: auth.token } } )
    socket.on( 'connect', () => {
      connesso.value = true
      errore.value = null
      // Dopo una riconnessione il socket e' nuovo e il server conta la presenza solo dopo partita:entra.
      // Se il server non la conosce piu' (riavvio), l'errore resta visibile e il tavolo torna alla lobby.
      if ( agg.value ) {
        socket?.emit( 'partita:entra', { codice: agg.value.codice }, ( r: Risposta ) => {
          if ( r.ok ) return
          errore.value = r.errore ?? 'Errore'
          if ( r.errore === 'Partita non trovata' ) agg.value = null
        } )
      }
    } )
    socket.on( 'disconnect', () => { connesso.value = false } )
    socket.on( 'connect_error', ( e: Error ) => { connesso.value = false; errore.value = e.message } )
    socket.on( 'partita:aggiornamento', ( a: Aggiornamento ) => {
      if ( agg.value && agg.value.codice !== a.codice ) return
      agg.value = a
      errore.value = null
      if ( selezionata.value && !a.vista?.giocatori[a.ruolo].mano?.some( ( c ) => c.uid === selezionata.value ) ) {
        selezionata.value = null
      }
    } )
  }

  function chiedi( evento: string, dati: unknown ): Promise<Risposta> {
    return new Promise( ( resolve ) => {
      if ( !socket ) return resolve( { ok: false, errore: 'Non connesso' } )
      socket.emit( evento, dati, ( r: Risposta ) => resolve( r ) )
    } )
  }

  function esito( r: Risposta ): boolean {
    errore.value = r.ok ? null : r.errore ?? 'Errore'
    return r.ok
  }

  async function crea( deckId: string ): Promise<string | null> {
    agg.value = null
    const r = await chiedi( 'partita:crea', { deckId } )
    return esito( r ) ? r.codice ?? null : null
  }

  async function entra( codice: string, deckId?: string ): Promise<boolean> {
    if ( agg.value?.codice !== codice ) agg.value = null
    return esito( await chiedi( 'partita:entra', deckId ? { codice, deckId } : { codice } ) )
  }

  async function invia( azione: Azione ): Promise<boolean> {
    if ( !agg.value ) return false
    const ok = esito( await chiedi( 'partita:azione', { codice: agg.value.codice, azione } ) )
    if ( ok ) selezionata.value = null
    return ok
  }

  async function arrenditi(): Promise<boolean> {
    if ( !agg.value ) return false
    return esito( await chiedi( 'partita:arrenditi', { codice: agg.value.codice } ) )
  }

  async function annulla(): Promise<boolean> {
    if ( !agg.value ) return false
    const ok = esito( await chiedi( 'partita:annulla', { codice: agg.value.codice } ) )
    if ( ok ) agg.value = null
    return ok
  }

  async function mie(): Promise<PartitaAperta[]> {
    const r = await chiedi( 'partita:mie', {} )
    return r.ok ? r.partite ?? [] : []
  }

  function seleziona( uid: string | null ) {
    selezionata.value = uid
  }

  function disconnetti() {
    socket?.disconnect()
    socket = null
    agg.value = null
    connesso.value = false
  }

  return {
    agg, connesso, errore, selezionata, vista, tocca, colonneGiocabili, anteprima, bersagli,
    mosseDi, mosseEffetto, mostraAnteprima, connetti, crea, entra, invia, arrenditi, annulla, mie, seleziona, disconnetti,
  }
} )
