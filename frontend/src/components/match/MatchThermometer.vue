<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ tp: number; flusso: 'normale' | 'invertito' }>()
// +4 al 13,6% dell'altezza dell'immagine, -4 all'83,8%: 8,78% per unità (misurato sul tabellone 6.0).
const top = computed( () => `${( 13.6 + ( 4 - props.tp ) * 8.78 ).toFixed( 2 )}%` )
</script>

<template>
  <div class="termometro" :class="{ invertito: flusso === 'invertito' }">
    <img src="/images/match/termometro.webp" alt="Termometro" />
    <span data-test="indicatore-tp" class="termometro__indicatore" :style="{ top }" :aria-label="`TP ${tp}`" />
  </div>
</template>

<style scoped>
.termometro { position: relative; width: 4.5rem; }
.termometro img { width: 100%; display: block; }
.termometro__indicatore { position: absolute; left: 50%; width: 70%; height: .5rem; transform: translate(-50%, -50%); border-radius: .25rem; background: #fff; box-shadow: 0 0 .6rem #fff; transition: top .5s ease; }
.termometro.invertito { animation: inversione .8s ease; }
@keyframes inversione { 50% { transform: rotate(180deg); filter: hue-rotate(180deg); } }
</style>
