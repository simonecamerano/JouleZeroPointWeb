<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import { useCardStore } from '../../stores/cardStore'
import type { AzioneBase, Colonna, Durata, PlayerId, StatoMateria } from '../../types/match'

const props = defineProps<{ bersaglio: string | null }>()
const match = useMatchStore()
const cards = useCardStore()
const v = computed( () => match.vista! )
const io = computed( () => match.agg!.ruolo )
const avv = computed<PlayerId>( () => ( io.value === 'A' ? 'B' : 'A' ) )
const d = computed( () => ( v.value.decisione?.tipo === 'effettoManuale' ? v.value.decisione : null ) )
const visibile = computed( () => !!d.value && match.tocca )

function cardIdDi( uid: string ): number | null {
  for ( const col of Object.values( v.value.colonne ) ) {
    const c = col.find( ( x ) => x.uid === uid )
    if ( c ) return c.cardId
  }
  const s = v.value.stack.find( ( x ) => x.uid === uid )
  if ( s ) return s.cardId
  for ( const g of Object.values( v.value.giocatori ) ) {
    if ( g.costruttore.uid === uid ) return g.costruttore.cardId
    const m = g.mano?.find( ( x ) => x.uid === uid )
    if ( m ) return m.cardId
  }
  if ( v.value.anomalia?.uid === uid ) return v.value.anomalia.cardId
  return null
}

const carta = computed( () => {
  if ( !d.value ) return null
  const id = cardIdDi( d.value.uid )
  return id === null ? null : cards.getCardById( id ) ?? null
} )
const nomeBersaglio = computed( () => {
  if ( !props.bersaglio ) return null
  const id = cardIdDi( props.bersaglio )
  return id === null ? 'carta coperta' : cards.getCardById( id )?.name ?? `Carta ${id}`
} )

const durata = ref<Durata>( 'collisione' )
const stato = ref<StatoMateria>( 'Solido' )
const colonna = ref<Colonna>( 'presente' )

const base = ( b: AzioneBase ) => match.invia( { tipo: 'base', base: b } )
const suBersaglio = ( f: ( uid: string ) => AzioneBase ) => { if ( props.bersaglio ) base( f( props.bersaglio ) ) }
</script>

<template>
  <div v-if="visibile" class="manuale">
    <h3>{{ carta?.name ?? 'Effetto' }}</h3>
    <p class="manuale__testo">{{ carta?.effect || 'Nessun testo.' }}</p>
    <p>Bersaglio: <strong>{{ nomeBersaglio ?? 'clicca una carta sul tavolo' }}</strong></p>

    <div class="manuale__gruppo">
      <span>TP</span>
      <button data-test="tp-meno" @click="base({ op: 'tp', delta: -1 })">−1</button>
      <button data-test="tp-piu" @click="base({ op: 'tp', delta: 1 })">+1</button>
      <button data-test="inversione" @click="base({ op: 'inversione', volontaria: true })">Inversione (1 danno a te)</button>
    </div>

    <div class="manuale__gruppo">
      <span>IT</span>
      <button data-test="danno-avversario" @click="base({ op: 'dannoIT', bersaglio: avv, valore: 1 })">1 danno all'avversario</button>
      <button data-test="danno-me" @click="base({ op: 'dannoIT', bersaglio: io, valore: 1 })">1 danno a te</button>
      <button data-test="pesca" @click="base({ op: 'pesca' })">Pesca 1</button>
    </div>

    <div class="manuale__gruppo">
      <span>Sul bersaglio</span>
      <select v-model="durata" aria-label="Durata">
        <option value="collisione">fino a fine Collisione</option>
        <option value="round">fino a fine round</option>
        <option value="permanente">permanente</option>
      </select>
      <button data-test="pep-meno" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'pep', delta: -1, durata }))">PEP −1</button>
      <button data-test="pep-piu" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'pep', delta: 1, durata }))">PEP +1</button>
      <button data-test="rp-meno" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'rp', delta: -1, durata }))">RP −1</button>
      <button data-test="rp-piu" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'modifica', uid, stat: 'rp', delta: 1, durata }))">RP +1</button>
    </div>

    <div class="manuale__gruppo">
      <select v-model="stato" aria-label="Stato">
        <option v-for="s in ['Solido', 'Liquido', 'Gas', 'Plasma', 'Materia Oscura']" :key="s" :value="s">{{ s }}</option>
      </select>
      <button data-test="cambia-stato" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'cambiaStato', uid, stato }))">Cambia stato</button>
      <select v-model="colonna" aria-label="Colonna">
        <option value="passato">Passato</option>
        <option value="presente">Presente</option>
        <option value="futuro">Futuro</option>
      </select>
      <button data-test="sposta" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'sposta', uid, colonna }))">Sposta</button>
    </div>

    <div class="manuale__gruppo">
      <button data-test="caldo" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'segnalino', uid, segnalino: 'caldo' }))">🔴</button>
      <button data-test="freddo" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'segnalino', uid, segnalino: 'freddo' }))">🔵</button>
      <button data-test="togli-segnalino" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'segnalino', uid, segnalino: null }))">Togli segnalino</button>
      <button data-test="distruggi" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'distruggi', uid }))">Distruggi</button>
      <button data-test="scarta" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'scarta', uid }))">Scarta</button>
      <button data-test="annulla" :disabled="!bersaglio" @click="suBersaglio((uid) => ({ op: 'annulla', uid }))">Annulla effetto</button>
    </div>

    <button data-test="fatto" class="manuale__fatto" @click="match.invia({ tipo: 'fatto' })">Fatto</button>
  </div>
</template>

<style scoped>
.manuale { max-height: 30vh; overflow-y: auto; padding: .6rem 1rem; background: #0b0e1af2; border: 1px solid #5c6bff88; border-radius: .6rem; }
.manuale__testo { white-space: pre-line; font-style: italic; }
.manuale__gruppo { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; margin: .4rem 0; }
.manuale__fatto { width: 100%; margin-top: .5rem; }
</style>
