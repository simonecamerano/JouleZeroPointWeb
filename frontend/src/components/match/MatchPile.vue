<script setup lang="ts">
import MatchCard from './MatchCard.vue'
defineProps<{ titolo: string; cima: number | null; conteggio: number; coperta?: boolean; mia?: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <div class="pila" :class="mia ? 'pila--mia' : 'pila--avversario'">
    <span class="pila__titolo">{{ titolo }}</span>
    <MatchCard v-if="conteggio > 0" piccola :card-id="cima" :coperta="coperta" @click="$emit('click')" />
    <div v-else class="pila__vuota" />
    <span class="pila__conteggio">{{ conteggio }}</span>
  </div>
</template>

<style scoped>
.pila { display: flex; flex-direction: column; align-items: center; gap: .2rem; padding: .3rem; border: 1px solid #5c6bff55; border-radius: .5rem; box-shadow: inset 0 0 .6rem #5c6bff33; }
.pila__titolo { font-size: .65rem; text-transform: uppercase; letter-spacing: .05em; opacity: .8; }
.pila__vuota { width: 4.2rem; aspect-ratio: 2 / 3; border: 1px dashed #ffffff33; border-radius: .4rem; }
.pila__conteggio { font-size: .75rem; }
.pila--mia { border-color: #4fd1c5aa; }
.pila--avversario { border-color: #f6ad55aa; }
</style>
