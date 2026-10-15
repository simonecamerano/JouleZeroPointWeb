<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import type { Colonna, VistaCampo } from '../../types/match'
import MatchCard from './MatchCard.vue'

const props = defineProps<{ colonna: Colonna; carte: VistaCampo[] }>()
const emit = defineEmits<{ carta: [uid: string] }>()
const match = useMatchStore()
const io = computed( () => match.agg!.ruolo )
const mie = computed( () => props.carte.filter( ( c ) => c.owner === io.value ) )
const loro = computed( () => props.carte.filter( ( c ) => c.owner !== io.value ) )
const destinazione = computed( () => match.colonneGiocabili.includes( props.colonna ) )
const etichetta = ( uid: string ) => ( match.mosseEffetto( uid )[0]?.tipo === 'attivaEffetto' ? 'Attiva' : 'Manuale' )
const NOMI: Record<Colonna, string> = { passato: 'Passato', presente: 'Presente', futuro: 'Futuro' }

function gioca() {
  if ( !destinazione.value || !match.selezionata ) return
  match.invia( { tipo: 'giocaCarta', uid: match.selezionata, colonna: props.colonna } )
}
</script>

<template>
  <div
    :data-test="`colonna-${colonna}`"
    class="colonna"
    :class="{ destinazione }"
    :style="{ backgroundImage: `url(/images/match/colonna-${colonna}.webp)` }"
    @click.self="gioca"
  >
    <div data-test="meta-avversario" class="colonna__meta" @click.self="gioca">
      <MatchCard
        v-for="c in loro" :key="c.uid" :data-uid="c.uid" :uid="c.uid" :card-id="c.cardId" :coperta="c.coperta" :segnalino="c.segnalino"
        :evidenziata="match.bersagli.includes(c.uid)" class="avversario" @click="emit('carta', c.uid)"
      />
    </div>
    <span class="colonna__nome">{{ NOMI[colonna] }}</span>
    <div data-test="meta-mia" class="colonna__meta" @click.self="gioca">
      <div v-for="c in mie" :key="c.uid" class="slot">
        <MatchCard
          :data-uid="c.uid" :uid="c.uid" :card-id="c.cardId" :coperta="c.coperta" :segnalino="c.segnalino"
          :evidenziata="match.bersagli.includes(c.uid)" class="mia" @click="emit('carta', c.uid)"
        />
        <button
          v-if="match.mosseEffetto(c.uid)[0]" type="button" data-test="azione-carta" class="slot__azione"
          @click="match.invia(match.mosseEffetto(c.uid)[0])"
        >{{ etichetta(c.uid) }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.colonna { display: grid; grid-template-rows: 1fr auto 1fr; background-size: 100% 100%; border-radius: .8rem; padding: .6rem .4rem; min-height: 0; }
.colonna.destinazione { box-shadow: 0 0 1rem .3rem #ffd36b; cursor: pointer; }
.colonna__meta { display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: .3rem; --carta-l: 4.6rem; }
.colonna__nome { text-align: center; font-size: .7rem; text-transform: uppercase; letter-spacing: .1em; opacity: .7; }
.slot { display: flex; flex-direction: column; align-items: center; gap: .15rem; }
.slot__azione { font-size: .65rem; padding: .1rem .4rem; }
.avversario :deep(img) { outline: 2px solid #f6ad55; }
.mia :deep(img) { outline: 2px solid #4fd1c5; }
</style>
