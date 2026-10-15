<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import { useCardStore } from '../../stores/cardStore'
import type { Decisione } from '../../types/match'

const match = useMatchStore()
const cards = useCardStore()
const v = computed( () => match.vista! )
const d = computed( () => v.value.decisione as Decisione | null )
const io = computed( () => match.agg!.ruolo )
const NOMI_COL = { passato: 'Passato', presente: 'Presente', futuro: 'Futuro' } as const
const MOTIVI: Record<string, string> = {
  collasso: 'Collasso (IT a zero)', sincronia: 'Sincronia', collassoEntropico: 'Collasso Entropico (mazzo vuoto)',
  pareggio: 'Pareggio', abbandono: 'Abbandono', chiusa: 'Partita chiusa',
}

const ora = ref( Date.now() )
let t: ReturnType<typeof setInterval> | undefined
onMounted( () => { t = setInterval( () => { ora.value = Date.now() }, 500 ) } )
onBeforeUnmount( () => clearInterval( t ) )
const secondi = computed( () => ( match.agg!.scadenzaFinestra ? Math.max( 0, Math.ceil( ( match.agg!.scadenzaFinestra - ora.value ) / 1000 ) ) : null ) )

const scambio = computed( () => ( match.selezionata ? match.mosseDi( match.selezionata ).find( ( m ) => m.tipo === 'scambio' ) : undefined ) )
const giocabile = computed( () => ( match.selezionata
  ? match.mosseDi( match.selezionata ).find( ( m ) => m.tipo === 'giocaCarta' && !m.colonna ) : undefined ) )
const nomeCarta = ( id: number ) => cards.getCardById( id )?.name ?? `Carta ${id}`
const esitoTesto = computed( () => {
  const e = v.value.esito
  if ( !e ) return ''
  return e.vincitore === null ? 'Pareggio' : e.vincitore === io.value ? 'Hai vinto' : 'Hai perso'
} )

function arrenditi() {
  if ( window.confirm( 'Vuoi davvero abbandonare la partita?' ) ) match.arrenditi()
}
</script>

<template>
  <div class="pannello">
    <template v-if="v.esito">
      <h2>{{ esitoTesto }}</h2>
      <p>{{ MOTIVI[v.esito.motivo] ?? v.esito.motivo }}</p>
      <RouterLink to="/partita">Nuova partita</RouterLink>
    </template>

    <template v-else-if="match.tocca && d">
      <template v-if="d.tipo === 'sceltaIniziativa'">
        <p>Hai vinto il dado.</p>
        <button data-test="iniziativa-tieni" @click="match.invia({ tipo: 'sceltaIniziativa', tieni: true })">Tengo l'iniziativa</button>
        <button data-test="iniziativa-cedi" @click="match.invia({ tipo: 'sceltaIniziativa', tieni: false })">La cedo</button>
      </template>
      <template v-else-if="d.tipo === 'mulligan'">
        <p>Vuoi rimescolare la mano e pescarne 4?</p>
        <button data-test="mulligan-no" @click="match.invia({ tipo: 'mulligan', esegui: false })">Tengo la mano</button>
        <button data-test="mulligan-si" @click="match.invia({ tipo: 'mulligan', esegui: true })">Mulligan</button>
      </template>
      <template v-else-if="d.tipo === 'bonusControllo'">
        <p>Bonus Controllo: hai più Frammenti nel Presente.</p>
        <button data-test="bonus-si" @click="match.invia({ tipo: 'bonusControllo', pesca: true })">Pesco la carta extra</button>
        <button data-test="bonus-no" @click="match.invia({ tipo: 'bonusControllo', pesca: false })">Rinuncio</button>
      </template>
      <template v-else-if="d.tipo === 'sceltaEffetto' && d.domanda">
        <p data-test="testo-scelta">{{ d.domanda.testo }}</p>
        <template v-if="d.domanda.tipo === 'siNo'">
          <button data-test="scelta-si" @click="match.invia({ tipo: 'rispondi', risposta: true })">Sì</button>
          <button data-test="scelta-no" @click="match.invia({ tipo: 'rispondi', risposta: false })">No</button>
        </template>
        <template v-else-if="d.domanda.tipo === 'opzione'">
          <button v-for="( o, i ) in d.domanda.opzioni" :key="i" :data-test="`opzione-${i}`"
            @click="match.invia({ tipo: 'rispondi', risposta: i })">{{ o }}</button>
        </template>
        <p v-else>Clicca uno dei bersagli evidenziati.</p>
        <p v-if="secondi !== null">{{ secondi }} s</p>
      </template>
      <p v-else-if="d.tipo === 'capienza'">Colonna piena: clicca il tuo Frammento da distruggere nel {{ NOMI_COL[d.colonna] }}.</p>
    </template>

    <p v-else-if="!match.tocca && d?.tipo === 'sceltaEffetto'" data-test="attesa-scelta">
      L'avversario sta scegliendo per {{ nomeCarta(d.cardId) }}
    </p>

    <template v-else-if="match.tocca && v.finestra">
      <p>{{ v.finestra.contesto === 'collisione' ? 'Collisione: puoi rispondere con un Evento' : 'Puoi rispondere con un Evento' }}</p>
      <p v-if="secondi !== null">{{ secondi }} s</p>
      <button v-if="giocabile" data-test="gioca" @click="match.invia(giocabile!)">Gioca la carta selezionata</button>
      <button data-test="passa" @click="match.invia({ tipo: 'passa' })">Passa</button>
    </template>

    <template v-else-if="match.tocca && v.fase === 'azioni'">
      <button data-test="passa-turno" @click="match.invia({ tipo: 'passaTurno' })">Passa il turno</button>
      <button v-if="giocabile" data-test="gioca" @click="match.invia(giocabile!)">Gioca la carta selezionata</button>
      <button v-if="scambio" data-test="scambio" @click="match.invia(scambio!)">Scambia la carta selezionata (+1 ET)</button>
    </template>

    <button v-if="!v.esito" class="pannello__resa" data-test="arrenditi" @click="arrenditi">Arrenditi</button>
  </div>
</template>

<style scoped>
.pannello { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; padding: .5rem .8rem; background: #0b0e1add; border-radius: .5rem; margin-top: .3rem; }
.pannello p { margin: 0; }
.pannello__resa { margin-left: auto; padding: .45rem 1.1rem; font-size: .95rem; border: 1px solid #ff6b6b; color: #ffb3b3; background: transparent; border-radius: .4rem; }
</style>
