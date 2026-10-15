import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  vista, tocca: true, selezionata: null as string | null, errore: null as string | null, connesso: true,
  colonneGiocabili: [] as string[], bersagli: [] as string[], anteprima: null,
  mosseEffetto: ( uid: string ) => ( uid === 'A-5' ? [{ tipo: 'attivaEffetto', uid: 'A-5', indice: 0 }] : [] ),
  mostraAnteprima: vi.fn(),
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

  it( 'la barra mostra l errore e la connessione persa', async () => {
    const w = mount( MatchTable )
    expect( w.find( '[data-test="errore-tavolo"]' ).exists() ).toBe( false )
    expect( w.find( '[data-test="connessione-persa"]' ).exists() ).toBe( false )
    store.errore = 'Partita non trovata'
    store.connesso = false
    await w.vm.$nextTick()
    expect( w.get( '[data-test="errore-tavolo"]' ).text() ).toBe( 'Partita non trovata' )
    expect( w.get( '[data-test="connessione-persa"]' ).text() ).toContain( 'Connessione persa' )
    store.errore = null
    store.connesso = true
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

  it( 'una carta con effetto attivabile ha il suo bottone', async () => {
    const w = mount( MatchTable )
    await w.get( '[data-test="colonna-presente"] [data-test="azione-carta"]' ).trigger( 'click' )
    expect( store.invia ).toHaveBeenCalledWith( { tipo: 'attivaEffetto', uid: 'A-5', indice: 0 } )
  } )

  it( 'durante una scelta di bersaglio il clic su una carta evidenziata risponde', async () => {
    store.bersagli = ['B-7']
    vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 46, domanda: { tipo: 'bersaglio', testo: 't', uids: ['B-7'] } }
    const w = mount( MatchTable )
    await w.get( '[data-test="colonna-presente"] [data-uid="B-7"]' ).trigger( 'click' )
    expect( store.invia ).toHaveBeenCalledWith( { tipo: 'rispondi', risposta: 'B-7' } )
    vista.decisione = null
    store.bersagli = []
  } )

  it( 'il registro mostra le voci', () => {
    const w = mount( MatchTable )
    expect( w.get( '[data-test="registro"]' ).text() ).toContain( 'Giocatore A gioca Carta 1 nel Presente' )
  } )

  it( 'lo stack delle risposte mostra le carte (coperta col retro)', async () => {
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

  describe( 'effetto manuale: bersaglio da mano e stack', () => {
    beforeEach( () => {
      store.invia.mockClear()
      store.seleziona.mockClear()
      store.vista.decisione = { tipo: 'effettoManuale', giocatore: 'A', uid: 'A-5', origine: 'libero' }
    } )
    afterEach( () => { store.vista.decisione = null; store.vista.stack = [] } )

    it( 'click su una carta in mano imposta il bersaglio e scarta usa quell uid', async () => {
      const w = mount( MatchTable )
      await w.get( '[data-test="mano-mia"] [data-uid="A-2"]' ).trigger( 'click' )
      expect( store.seleziona ).not.toHaveBeenCalled()
      await w.get( '[data-test="scarta"]' ).trigger( 'click' )
      expect( store.invia ).toHaveBeenCalledWith( { tipo: 'base', base: { op: 'scarta', uid: 'A-2' } } )
    } )

    it( 'click su una carta dello stack imposta il bersaglio e annulla usa quell uid', async () => {
      store.vista.stack = [{ uid: 'B-9', cardId: 2, controllore: 'B', annullata: false }]
      const w = mount( MatchTable )
      await w.get( '[data-test="stack"] [data-uid="B-9"]' ).trigger( 'click' )
      await w.get( '[data-test="annulla"]' ).trigger( 'click' )
      expect( store.invia ).toHaveBeenCalledWith( { tipo: 'base', base: { op: 'annulla', uid: 'B-9' } } )
    } )

    it( 'il pannello manuale sta nell area pannello della griglia, in flusso e non fixed', () => {
      const w = mount( MatchTable )
      const area = w.get( '[data-test="area-pannello"]' )
      expect( area.classes() ).toContain( 'tavolo__pannello' )
      const manuale = area.get( '.manuale' )
      expect( manuale.classes() ).not.toContain( 'fixed' )
      const css = readFileSync( 'src/components/match/MatchManualPanel.vue', 'utf8' )
      expect( css ).not.toMatch( /position:\s*fixed/ )
      expect( readFileSync( 'src/components/match/MatchDecisionPanel.vue', 'utf8' ) ).not.toMatch( /position:\s*fixed/ )
    } )

    it( 'fuori da effettoManuale il click in mano seleziona come prima', async () => {
      store.vista.decisione = null
      const w = mount( MatchTable )
      await w.get( '[data-test="mano-mia"] [data-uid="A-1"]' ).trigger( 'click' )
      expect( store.seleziona ).toHaveBeenCalledWith( 'A-1' )
      expect( w.find( '[data-test="scarta"]' ).exists() ).toBe( false )
    } )
  } )
} )
