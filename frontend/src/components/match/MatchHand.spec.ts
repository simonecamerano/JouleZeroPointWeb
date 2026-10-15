import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const store = reactive( {
  tocca: true, selezionata: null as string | null, bersagli: [] as string[],
  vista: { decisione: null as unknown },
  mosseDi: ( uid: string ) => ( uid === 'A-9' ? [{ tipo: 'giocaCarta', uid: 'A-9' }, { tipo: 'scambio', uid: 'A-9' }] : [] ),
  seleziona: vi.fn(), invia: vi.fn(), mostraAnteprima: vi.fn(),
} )
vi.mock( '../../stores/matchStore', () => ( { useMatchStore: () => store } ) )
vi.mock( '../../stores/cardStore', () => ( { useCardStore: () => ( { getCardById: () => ( { name: 'Evento', effect: '' } ) } ) } ) )

import MatchHand from './MatchHand.vue'

beforeEach( () => {
  store.seleziona.mockClear()
  store.invia.mockClear()
  store.bersagli = []
  store.vista.decisione = null
} )

describe( 'MatchHand', () => {
  it( 'il clic su un Evento lo seleziona e non lo gioca: così si può scambiare', async () => {
    const w = mount( MatchHand, { props: { carte: [{ uid: 'A-9', cardId: 46, owner: 'A' }] } } )
    await w.get( '[data-uid="A-9"]' ).trigger( 'click' )
    expect( store.seleziona ).toHaveBeenCalledWith( 'A-9' )
    expect( store.invia ).not.toHaveBeenCalled()
  } )

  it( 'durante una scelta di bersaglio il clic manda la carta al tavolo', async () => {
    store.bersagli = ['A-9']
    store.vista.decisione = { tipo: 'sceltaEffetto', giocatore: 'A', uid: 'A-C', cardId: 67, domanda: { tipo: 'bersaglio', testo: 't', uids: ['A-9'] } }
    const w = mount( MatchHand, { props: { carte: [{ uid: 'A-9', cardId: 46, owner: 'A' }] } } )
    await w.get( '[data-uid="A-9"]' ).trigger( 'click' )
    expect( w.emitted( 'carta' ) ).toEqual( [['A-9']] )
  } )
} )
