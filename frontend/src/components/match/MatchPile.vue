<script setup lang="ts">
import { useMatchStore } from '../../stores/matchStore'
import MatchCard from './MatchCard.vue'
defineProps<{ titolo: string; cima: number | null; conteggio: number; coperta?: boolean; mia?: boolean; uid?: string; evidenziata?: boolean }>()
defineEmits<{ click: [] }>()
const match = useMatchStore()
const etichetta = ( uid: string ) => ( match.mosseEffetto( uid )[0]?.tipo === 'attivaEffetto' ? 'Attiva' : 'Manuale' )
</script>

<template>
  <div class="pila" :class="mia ? 'pila--mia' : 'pila--avversario'">
    <span class="pila__titolo">{{ titolo }}</span>
    <MatchCard v-if="conteggio > 0" piccola :uid="uid" :data-uid="uid" :card-id="cima" :coperta="coperta" :evidenziata="evidenziata" @click="$emit('click')" />
    <div v-else class="pila__vuota" />
    <button
      v-if="uid && match.mosseEffetto(uid)[0]" type="button" data-test="azione-carta" class="pila__azione"
      @click="match.invia(match.mosseEffetto(uid)[0])"
    >{{ etichetta(uid) }}</button>
    <span class="pila__conteggio">{{ conteggio }}</span>
  </div>
</template>

<style scoped>
.pila { display: flex; flex-direction: column; align-items: center; gap: .2rem; padding: .3rem; border: 1px solid #5c6bff55; border-radius: .5rem; box-shadow: inset 0 0 .6rem #5c6bff33; }
.pila__titolo { font-size: .65rem; text-transform: uppercase; letter-spacing: .05em; opacity: .8; }
.pila__vuota { width: 4.2rem; aspect-ratio: 2 / 3; border: 1px dashed #ffffff33; border-radius: .4rem; }
.pila__conteggio { font-size: .75rem; }
.pila__azione { font-size: .65rem; padding: .1rem .4rem; }
.pila--mia { border-color: #4fd1c5aa; }
.pila--avversario { border-color: #f6ad55aa; }
</style>
