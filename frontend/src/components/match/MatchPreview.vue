<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import { useCardStore } from '../../stores/cardStore'
import type { VistaCampo } from '../../types/match'

const match = useMatchStore()
const cards = useCardStore()
const a = computed( () => match.anteprima )
const carta = computed( () => ( a.value ? cards.getCardById( a.value.cardId ) ?? null : null ) )
const inCampo = computed<VistaCampo | null>( () => {
  const uid = a.value?.uid
  if ( !uid || !match.vista ) return null
  return Object.values( match.vista.colonne ).flat().find( ( c ) => c.uid === uid ) ?? null
} )
const somma = ( stat: 'pep' | 'rp' ) => ( inCampo.value?.modifiche ?? [] ).filter( ( m ) => m.stat === stat ).reduce( ( t, m ) => t + m.delta, 0 )
const pep = computed( () => Math.max( 0, ( carta.value?.pep ?? 0 ) + somma( 'pep' ) ) )
const rp = computed( () => Math.max( 0, ( carta.value?.rp ?? 0 ) + somma( 'rp' ) ) )
</script>

<template>
  <aside v-if="carta" data-test="anteprima" class="anteprima">
    <img v-if="carta.image_url" :src="carta.image_url" :alt="carta.name" />
    <h3>{{ carta.name }}</h3>
    <p class="anteprima__tipo">
      {{ inCampo?.statoForzato ?? carta.type }} · {{ carta.status }} · {{ carta.cost_et }} ET
      <span v-if="inCampo?.segnalino === 'caldo'">🔴</span><span v-if="inCampo?.segnalino === 'freddo'">🔵</span>
    </p>
    <p class="anteprima__stat">PEP <strong data-test="anteprima-pep">{{ pep }}</strong> · RP <strong data-test="anteprima-rp">{{ rp }}</strong></p>
    <p class="anteprima__testo">{{ carta.effect }}</p>
  </aside>
</template>

<style scoped>
.anteprima { position: fixed; right: 1rem; top: 6rem; z-index: 50; width: 17rem; padding: .7rem; background: #0b0e1af2; border: 1px solid #5c6bff88; border-radius: .6rem; pointer-events: none; }
.anteprima img { width: 100%; border-radius: .4rem; }
.anteprima h3 { margin: .4rem 0 .2rem; font-size: 1rem; }
.anteprima__tipo, .anteprima__stat { margin: .15rem 0; font-size: .85rem; }
.anteprima__testo { margin: .4rem 0 0; font-size: .85rem; line-height: 1.35; }
</style>
