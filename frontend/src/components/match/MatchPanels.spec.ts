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
  tocca: true, selezionata: null as string | null,
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
} )

describe( 'MatchDecisionPanel', () => {
  it( 'mulligan', async () => {
    store.vista.decisione = { tipo: 'mulligan', giocatore: 'A' }
    const w = mount( MatchDecisionPanel )
    await w.get( '[data-test="mulligan-si"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'mulligan', esegui: true } )
  } )

  it( 'finestra di risposta: passa e conto alla rovescia', async () => {
    store.vista.finestra = { contesto: 'giocata', priorita: 'A', passi: 0, passiNecessari: 1 }
    store.agg.scadenzaFinestra = Date.now() + 15000
    const w = mount( MatchDecisionPanel )
    expect( w.text() ).toMatch( /1[45] s/ )
    await w.get( '[data-test="passa"]' ).trigger( 'click' )
    expect( invia ).toHaveBeenCalledWith( { tipo: 'passa' } )
  } )

  it( 'fase azioni: passa il turno, scambio della carta selezionata, effetto del Costruttore', async () => {
    store.selezionata = 'A-1'
    const w = mount( MatchDecisionPanel )
    await w.get( '[data-test="passa-turno"]' ).trigger( 'click' )
    await w.get( '[data-test="scambio"]' ).trigger( 'click' )
    await w.get( '[data-test="costruttore"]' ).trigger( 'click' )
    expect( invia.mock.calls.map( ( c ) => c[0] ) ).toEqual( [
      { tipo: 'passaTurno' }, { tipo: 'scambio', uid: 'A-1' }, { tipo: 'usaEffetto', uid: 'A-C' },
    ] )
  } )

  it( 'non mostra nulla di azionabile quando non tocca a me', () => {
    store.tocca = false
    const w = mount( MatchDecisionPanel )
    expect( w.find( 'button' ).exists() ).toBe( false )
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
