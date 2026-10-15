import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const invia = vi.fn().mockResolvedValue( true )
const arrenditi = vi.fn().mockResolvedValue( true )
const store = reactive( {
  agg: { ruolo: 'A', statoTavolo: 'inCorso', scadenzaFinestra: null as number | null, mosse: [] as unknown[] },
  vista: {
    io: 'A', fase: 'azioni', tocca: 'A', finestra: null as unknown, decisione: null as unknown, esito: null as unknown,
    colonne: { passato: [], presente: [{ uid: 'A-5', owner: 'A', cardId: 1, coperta: false }], futuro: [] },
    giocatori: { A: { costruttore: { uid: 'A-C', cardId: 100 }, mano: [{ uid: 'A-1', cardId: 3 }] }, B: { costruttore: { uid: 'B-C', cardId: 100 } } },
    stack: [],
  },
  tocca: true, selezionata: null as string | null, bersagli: [] as string[],
  mosseEffetto: () => [] as unknown[],
  mosseDi: ( uid: string ) => ( uid === 'A-1' ? [{ tipo: 'scambio', uid: 'A-1' }] : [] ),
  invia, arrenditi,
} )
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/cardStore', () => ( { useCardStore: () => ( { getCardById: () => ( { name: 'Carta 1', effect: 'Aumenta la TP di 1.' } ) } ) } ) )

import MatchDecisionPanel from './MatchDecisionPanel.vue'
import MatchManualPanel from './MatchManualPanel.vue'

beforeEach( () => {
  invia.mockClear()
  store.vista.decisione = null
  store.vista.finestra = null
  store.vista.esito = null
  store.tocca = true
  store.selezionata = null
  store.mosseDi = ( uid: string ) => ( uid === 'A-1' ? [{ tipo: 'scambio', uid: 'A-1' }] : [] )
} )

describe( 'MatchDecisionPanel', () => {
  it( 'mulligan', async () => {
    store.vista.decisione = { tipo: 'mulligan', giocatore: 'A' }
    const w = mount( MatchDecisionPanel )
    await w.get( '[data-test="mulligan-si"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'mulligan', esegui: true } )
  } )

  it( 'Arrenditi resta disponibile anche quando non tocca a te, e sparisce a partita finita', async () => {
    store.tocca = false
    const w = mount( MatchDecisionPanel )
    const conferma = vi.spyOn( window, 'confirm' ).mockReturnValue( true )
    await w.get( '[data-test="arrenditi"]' ).trigger( 'click' )
    expect( conferma ).toHaveBeenCalled()
    expect( arrenditi ).toHaveBeenCalled()
    store.vista.esito = { vincitore: 'B', motivo: 'abbandono' }
    await w.vm.$nextTick()
    expect( w.find( '[data-test="arrenditi"]' ).exists() ).toBe( false )
    conferma.mockRestore()
  } )

  it( 'finestra di risposta: passa e conto alla rovescia', async () => {
    store.vista.finestra = { contesto: 'giocata', priorita: 'A', passi: 0, passiNecessari: 1 }
    store.agg.scadenzaFinestra = Date.now() + 15000
    const w = mount( MatchDecisionPanel )
    expect( w.text() ).toMatch( /1[45] s/ )
    await w.get( '[data-test="passa"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'passa' } )
  } )

  it( 'fase azioni: passa il turno, gioca e scambia la carta selezionata, niente bottone fisso del Costruttore', async () => {
    store.selezionata = 'A-1'
    store.mosseDi = ( uid: string ) => ( uid === 'A-1' ? [{ tipo: 'giocaCarta', uid: 'A-1' }, { tipo: 'scambio', uid: 'A-1' }] : [] )
    const w = mount( MatchDecisionPanel )
    await w.get( '[data-test="passa-turno"]' ).trigger( 'click' )
    await w.get( '[data-test="gioca"]' ).trigger( 'click' )
    await w.get( '[data-test="scambio"]' ).trigger( 'click' )
    expect( w.find( '[data-test="costruttore"]' ).exists() ).toBe( false )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'passaTurno' }, { tipo: 'giocaCarta', uid: 'A-1' }, { tipo: 'scambio', uid: 'A-1' },
    ] )
  } )

  it( 'scelta Sì/No e scelta fra opzioni', async () => {
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-5', cardId: 2, domanda: { tipo: 'siNo', testo: 'Faglia Primaria: vuoi distruggi questa carta?' } }
    const w = mount( MatchDecisionPanel )
    expect( w.text() ).toContain( 'Faglia Primaria: vuoi distruggi questa carta?' )
    await w.get( '[data-test="scelta-si"]' ).trigger( 'click' )
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-5', cardId: 19, domanda: { tipo: 'opzione', testo: 'scegli', opzioni: ['TP +1', 'TP -1'] } }
    await w.vm.$nextTick()
    await w.get( '[data-test="opzione-1"]' ).trigger( 'click' )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'rispondi', risposta: true }, { tipo: 'rispondi', risposta: 1 },
    ] )
  } )

  it( "quando sceglie l'avversario si vede solo che sta scegliendo", () => {
    store.tocca = false
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'B', uid: 'B-5', cardId: 2, domanda: null }
    const w = mount( MatchDecisionPanel )
    expect( w.get( '[data-test="attesa-scelta"]' ).text() ).toContain( 'Carta 1' )
  } )

  it( 'non mostra nulla di azionabile quando non tocca a me', () => {
    store.tocca = false
    const w = mount( MatchDecisionPanel )
    expect( w.findAll( 'button' ).map( ( b ) => b.attributes( 'data-test' ) ) ).toEqual( ['arrenditi'] )
  } )

  it( 'esito finale', () => {
    store.vista.esito = { vincitore: 'B', motivo: 'collasso' }
    const w = mount( MatchDecisionPanel )
    expect( w.text() ).toContain( 'Hai perso' )
    expect( w.text() ).toContain( 'Collasso (IT a zero)' )
  } )
} )

describe( 'MatchManualPanel', () => {
  beforeEach( () => { store.vista.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-5', origine: 'stack' } } )

  it( 'mostra il testo della carta e applica TP +1', async () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: null } } )
    expect( w.text() ).toContain( 'Aumenta la TP di 1.' )
    await w.get( '[data-test="tp-piu"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'base', base: { op: 'tp', delta: 1 } } )
  } )

  it( 'modifica PEP sul bersaglio scelto dal tavolo', async () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: 'A-5' } } )
    await w.get( '[data-test="pep-piu"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'base', base: { op: 'modifica', uid: 'A-5', stat: 'pep', delta: 1, durata: 'collisione' } } )
  } )

  it( 'le azioni su carta sono disattivate senza bersaglio', () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: null } } )
    expect( w.get( '[data-test="distruggi"]' ).attributes( 'disabled' ) ).toBeDefined()
  } )

  it( 'danno IT all avversario e fatto', async () => {
    const w = mount( MatchManualPanel, { props: { bersaglio: null } } )
    await w.get( '[data-test="danno-avversario"]' ).trigger( 'click' )
    await w.get( '[data-test="fatto"]' ).trigger( 'click' )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'base', base: { op: 'dannoIT', bersaglio: 'B', valore: 1 } }, { tipo: 'fatto' },
    ] )
  } )
} )
