<script setup lang="ts">
import { useMatchStore } from '../../stores/matchStore'
import type { Carta } from '../../types/match'
import MatchCard from './MatchCard.vue'

defineProps<{ carte: Carta[] }>()
const match = useMatchStore()

function click( c: Carta ) {
  const mosse = match.mosseDi( c.uid )
  if ( !mosse.length ) return
  // Evento o Anomalia: una sola mossa senza colonna, si gioca subito.
  const senzaColonna = mosse.find( ( m ) => m.tipo === 'giocaCarta' && !m.colonna )
  if ( senzaColonna ) {
    match.invia( senzaColonna )
    return
  }
  match.seleziona( match.selezionata === c.uid ? null : c.uid )
}
</script>

<template>
  <div data-test="mano-mia" class="mano">
    <MatchCard
      v-for="c in carte"
      :key="c.uid"
      :data-uid="c.uid"
      :card-id="c.cardId"
      :attenuata="match.mosseDi(c.uid).length === 0"
      :selezionata="match.selezionata === c.uid"
      @click="click(c)"
    />
  </div>
</template>

<style scoped>
.mano { display: flex; justify-content: center; gap: .4rem; padding: .5rem; --carta-l: 6.5rem; }
</style>
