import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const crea = vi.fn()
const entra = vi.fn()
const mie = vi.fn()
const annulla = vi.fn()
const store = reactive( { crea, entra, mie, annulla, errore: null as string | null, agg: null as unknown } )
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/deckStore', () => ( {
  useDeckStore: () => ( {
    fetchUserDecks: vi.fn(),
    userDecks: [
      { id: 'd1', name: 'Completo', costruttoreId: 100, cards: [{ cardId: 1, count: 40 }] },
      { id: 'd2', name: 'Corto', costruttoreId: 100, cards: [{ cardId: 1, count: 12 }] },
    ],
  } ),
} ) )
const replace = vi.fn()
vi.mock( 'vue-router', () => ( { useRouter: () => ( { replace } ) } ) )

import MatchLobby from './MatchLobby.vue'

describe( 'MatchLobby', () => {
  beforeEach( () => {
    setActivePinia( createPinia() )
    crea.mockReset(); entra.mockReset(); replace.mockReset(); annulla.mockReset()
    mie.mockReset(); mie.mockResolvedValue( [] )
    store.agg = null
    store.errore = null
  } )

  it( 'senza codice: i mazzi incompleti sono disattivati, crea porta alla rotta col codice', async () => {
    crea.mockResolvedValue( 'NUOVO123' )
    const w = mount( MatchLobby, { props: { codice: null } } )
    await flushPromises()
    expect( w.text() ).toContain( 'Mazzo incompleto: 12 carte' )
    await w.get( '[data-test="mazzo-d1"]' ).trigger( 'click' )
    await w.get( '[data-test="crea"]' ).trigger( 'click' )
    await flushPromises()
    expect( crea ).toHaveBeenCalledWith( 'd1' )
    expect( replace ).toHaveBeenCalledWith( '/partita/NUOVO123' )
  } )

  it( 'con codice: prova a rientrare, se serve un mazzo mostra la scelta e poi entra', async () => {
    entra.mockImplementationOnce( async () => { store.errore = 'Scegli un mazzo'; return false } )
    entra.mockResolvedValueOnce( true )
    const w = mount( MatchLobby, { props: { codice: 'COD' } } )
    await flushPromises()
    expect( entra ).toHaveBeenCalledWith( 'COD' )
    await w.get( '[data-test="mazzo-d1"]' ).trigger( 'click' )
    await w.get( '[data-test="entra"]' ).trigger( 'click' )
    await flushPromises()
    expect( entra ).toHaveBeenLastCalledWith( 'COD', 'd1' )
  } )

  it( 'partita al completo: messaggio e link alla lobby', async () => {
    entra.mockImplementationOnce( async () => { store.errore = 'La partita è già al completo'; return false } )
    const w = mount( MatchLobby, { props: { codice: 'COD' }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } } )
    await flushPromises()
    expect( w.text() ).toContain( 'La partita è già al completo' )
    expect( w.find( '[data-test="scelta-mazzo"]' ).exists() ).toBe( false )
  } )

  it( 'senza codice: elenca le partite aperte con il link per rientrare', async () => {
    mie.mockResolvedValue( [{ codice: 'AAA', statoTavolo: 'attesa' }, { codice: 'BBB', statoTavolo: 'inCorso' }] )
    const w = mount( MatchLobby, { props: { codice: null }, global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } } )
    await flushPromises()
    const lista = w.get( '[data-test="mie-partite"]' )
    expect( lista.findAll( 'a' ).map( ( a ) => a.attributes( 'href' ) ) ).toEqual( ['/partita/AAA', '/partita/BBB'] )
    expect( lista.text() ).toContain( 'in corso' )
  } )

  it( 'in attesa: Annulla invito chiama annulla e torna alla lobby', async () => {
    store.agg = { codice: 'COD', statoTavolo: 'attesa' }
    annulla.mockResolvedValue( true )
    entra.mockResolvedValue( true )
    const w = mount( MatchLobby, { props: { codice: 'COD' } } )
    await flushPromises()
    await w.get( '[data-test="annulla-invito"]' ).trigger( 'click' )
    await flushPromises()
    expect( annulla ).toHaveBeenCalled()
    expect( replace ).toHaveBeenCalledWith( '/partita' )
  } )

  it( 'in attesa: se annulla fallisce resta nella pagina e mostra l errore', async () => {
    store.agg = { codice: 'COD', statoTavolo: 'attesa' }
    annulla.mockImplementation( async () => { store.errore = 'La partita è già iniziata'; return false } )
    entra.mockResolvedValue( true )
    const w = mount( MatchLobby, { props: { codice: 'COD' } } )
    await flushPromises()
    await w.get( '[data-test="annulla-invito"]' ).trigger( 'click' )
    await flushPromises()
    expect( replace ).not.toHaveBeenCalled()
    expect( w.text() ).toContain( 'La partita è già iniziata' )
  } )
} )
