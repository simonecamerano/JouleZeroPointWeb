<script setup lang="ts">
import { useMatchStore } from '../../stores/matchStore'
import type { Carta } from '../../types/match'
import MatchCard from './MatchCard.vue'

defineProps<{ carte: Carta[] }>()
const emit = defineEmits<{ carta: [uid: string] }>()
const match = useMatchStore()

// Durante un effetto manuale o una scelta di bersaglio il click in mano indica una carta, non la gioca.
const inSceltaCarta = () => !!match.tocca && (
  match.vista?.decisione?.tipo === 'effettoManuale' || match.bersagli.length > 0
)

function click( c: Carta ) {
  if ( inSceltaCarta() ) {
    emit( 'carta', c.uid )
    return
  }
  if ( !match.mosseDi( c.uid ).length ) return
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
      :uid="c.uid"
      :attenuata="inSceltaCarta() ? !match.bersagli.includes(c.uid) && match.bersagli.length > 0 : match.mosseDi(c.uid).length === 0"
      :evidenziata="match.bersagli.includes(c.uid)"
      :selezionata="match.selezionata === c.uid"
      @click="click(c)"
    />
  </div>
</template>

<style scoped>
.mano { display: flex; justify-content: center; gap: .4rem; padding: .5rem; --carta-l: clamp(4.2rem, 12vh, 6.5rem); }
</style>
