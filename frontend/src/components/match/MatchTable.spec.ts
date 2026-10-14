import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import type { Aggiornamento, Vista, VistaGiocatore } from '../../types/match'

function giocatore( id: 'A' | 'B', mano: VistaGiocatore['mano'] ): VistaGiocatore {
  return {
    id, it: 20, et: 3, etMax: 3, mano, carteInMano: mano ? mano.length : 5, carteFuturo: 25,
    memoria: [], orizzonte: [], costruttore: { uid: `${id}-C`, cardId: 100, owner: id },
    supportoPep: 0, supportoRp: 0, scambioUsato: false, haPassato: false,
  }
}

const vista: Vista = {
  io: 'A', round: 2, fase: 'azioni', flusso: 'normale', tp: 2, iniziativa: 'A', attivo: 'A', tocca: 'A',
  anomalia: null,
  colonne: {
    passato: [],
    presente: [
      { uid: 'A-5', owner: 'A', coperta: false, cardId: 1, segnalino: 'caldo', statoForzato: null, modifiche: [] },
      { uid: 'B-7', owner: 'B', coperta: false, cardId: 2, segnalino: null, statoForzato: null, modifiche: [] },
    ],
    futuro: [{ uid: 'B-8', owner: 'B', coperta: true, cardId: null, segnalino: null, statoForzato: null, modifiche: [] }],
  },
  giocatori: { A: giocatore( 'A', [{ uid: 'A-1', cardId: 3, owner: 'A' }, { uid: 'A-2', cardId: 4, owner: 'A' }] ), B: giocatore( 'B', null ) },
  stack: [], finestra: null, decisione: null, esito: null,
  log: [{ round: 2, testo: 'Giocatore A gioca Carta 1 nel Presente' }],
}

const store = reactive( {
  agg: { codice: 'COD', statoTavolo: 'inCorso', ruolo: 'A', avversario: 'bob', scadenzaFinestra: null,
    mosse: [{ tipo: 'passaTurno' }, { tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' }], vista } as Aggiornamento,
  vista, tocca: true, selezionata: null as string | null, errore: null,
  colonneGiocabili: [] as string[],
  mosseDi: ( uid: string ) => ( uid === 'A-1' ? [{ tipo: 'giocaCarta', uid: 'A-1', colonna: 'presente' }] : [] ),
  seleziona: vi.fn(), invia: vi.fn(), arrenditi: vi.fn(),
} )
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/cardStore', () => ( {
  useCardStore: () => ( { fetchCards: vi.fn(), getCardById: ( id: number ) => ( { id, name: `Carta ${id}`, image_url: `/img/${id}.png`, effect: '' } ) } ),
} ) )

import MatchTable from './MatchTable.vue'

describe( 'MatchTable', () => {
  beforeEach( () => setActivePinia( createPinia() ) )

  it( 'le carte avversarie stanno nella metà alta della colonna, le proprie in quella bassa', () => {
    const w = mount( MatchTable )
    const presente = w.get( '[data-test="colonna-presente"]' )
    expect( presente.get( '[data-test="meta-avversario"]' ).html() ).toContain( '/img/2.png' )
    expect( presente.get( '[data-test="meta-mia"]' ).html() ).toContain( '/img/1.png' )
  } )

  it( 'la carta coperta avversaria mostra il retro', () => {
    const w = mount( MatchTable )
    expect( w.get( '[data-test="colonna-futuro"]' ).html() ).toContain( 'Retro_Ufficiale.png' )
  } )

  it( 'mano avversaria come conteggio, mano propria con le carte e quelle non giocabili attenuate', () => {
    const w = mount( MatchTable )
    expect( w.get( '[data-test="mano-avversario"]' ).text() ).toContain( '5' )
    const mano = w.get( '[data-test="mano-mia"]' )
    expect( mano.findAll( '.match-card' ) ).toHaveLength( 2 )
    expect( mano.get( '[data-uid="A-2"]' ).classes() ).toContain( 'attenuata' )
    expect( mano.get( '[data-uid="A-1"]' ).classes() ).not.toContain( 'attenuata' )
  } )

  it( 'barra di stato: IT, ET, fase, flusso, round e Tocca a te', () => {
    const w = mount( MatchTable )
    const barra = w.get( '[data-test="barra-stato"]' ).text()
    for ( const t of ['IT 20', 'ET 3/3', 'Azioni', 'Normale', 'Round 2', 'Tocca a te'] ) expect( barra ).toContain( t )
  } )

  it( 'il termometro posiziona l indicatore sulla TP', () => {
    const w = mount( MatchTable )
    const style = w.get( '[data-test="indicatore-tp"]' ).attributes( 'style' )
    expect( style ).toContain( 'top: 31.16%' )
  } )

  it( 'click su una carta in mano la seleziona', async () => {
    const w = mount( MatchTable )
    await w.get( '[data-test="mano-mia"] [data-uid="A-1"]' ).trigger( 'click' )
    expect( store.seleziona ).toHaveBeenCalledWith( 'A-1' )
  } )

  it( 'il registro mostra le voci', () => {
    const w = mount( MatchTable )
    expect( w.get( '[data-test="registro"]' ).text() ).toContain( 'Giocatore A gioca Carta 1 nel Presente' )
  } )

  it( 'lo stack delle risposte mostra le carte (coperta col retro) e il click emette il bersaglio', async () => {
    store.vista.stack = [
      { uid: 'B-9', cardId: 2, controllore: 'B', annullata: false },
      { uid: 'A-9', cardId: null, controllore: 'A', annullata: false },
    ]
    try {
      const w = mount( MatchTable )
      const stack = w.get( '[data-test="stack"]' )
      expect( stack.findAll( '.match-card' ) ).toHaveLength( 2 )
      expect( stack.get( '[data-uid="B-9"]' ).html() ).toContain( '/img/2.png' )
      expect( stack.get( '[data-uid="A-9"]' ).html() ).toContain( 'Retro_Ufficiale.png' )
      await stack.get( '[data-uid="B-9"]' ).trigger( 'click' )
      expect( w.emitted( 'carta' )![0] ).toEqual( ['B-9'] )
    } finally {
      store.vista.stack = []
    }
  } )

  it( 'una carta propria coperta mostra la faccia col marcatore, quella avversaria coperta il retro', () => {
    const futuro = store.vista.colonne.futuro
    futuro.push( { uid: 'A-8', owner: 'A', coperta: true, cardId: 7, segnalino: null, statoForzato: null, modifiche: [] } )
    try {
      const w = mount( MatchTable )
      const colonna = w.get( '[data-test="colonna-futuro"]' )
      const mia = colonna.get( '[data-test="meta-mia"]' )
      expect( mia.html() ).toContain( '/img/7.png' )
      expect( mia.get( '[data-test="marcatore-coperta"]' ).text() ).toContain( 'Coperta' )
      const loro = colonna.get( '[data-test="meta-avversario"]' )
      expect( loro.html() ).toContain( 'Retro_Ufficiale.png' )
      expect( loro.find( '[data-test="marcatore-coperta"]' ).exists() ).toBe( false )
    } finally {
      futuro.pop()
    }
  } )

  it( 'senza stack il blocco non compare', () => {
    expect( mount( MatchTable ).find( '[data-test="stack"]' ).exists() ).toBe( false )
  } )
} )
