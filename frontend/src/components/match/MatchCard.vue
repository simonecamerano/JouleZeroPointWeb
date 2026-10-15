<script setup lang="ts">
import { computed } from 'vue'
import { useCardStore } from '../../stores/cardStore'

const props = defineProps<{
  cardId: number | null
  coperta?: boolean
  piccola?: boolean
  segnalino?: 'caldo' | 'freddo' | null
  evidenziata?: boolean
  attenuata?: boolean
  selezionata?: boolean
  uid?: string
}>()
defineEmits<{ click: [] }>()
const cards = useCardStore()
const carta = computed( () => ( props.cardId === null ? null : cards.getCardById( props.cardId ) ?? null ) )
// Il retro solo se la vista non rivela la carta: il proprietario riceve cardId anche per le sue carte coperte.
const retro = computed( () => props.cardId === null )
const coperta = computed( () => !!props.coperta && props.cardId !== null )
</script>

<template>
  <button
    type="button"
    class="match-card"
    :class="{ piccola, evidenziata, attenuata, selezionata, coperta }"
    :title="retro ? 'Carta coperta' : carta ? `${carta.name}\n${carta.effect}` : `Carta ${cardId}`"
    @click="$emit('click')"
  >
    <img v-if="retro" src="/Retro_Ufficiale.png" alt="Carta coperta" />
    <img v-else-if="carta?.image_url" :src="carta.image_url" :alt="carta.name" />
    <span v-else class="match-card__nome">{{ carta?.name ?? `Carta ${cardId}` }}</span>
    <span v-if="coperta" data-test="marcatore-coperta" class="match-card__coperta">Coperta</span>
    <span v-if="segnalino === 'caldo'" class="match-card__segnalino" aria-label="Riscaldato">🔴</span>
    <span v-if="segnalino === 'freddo'" class="match-card__segnalino" aria-label="Raffreddato">🔵</span>
  </button>
</template>

<style scoped>
.match-card { position: relative; width: var(--carta-l, 6.2rem); aspect-ratio: 2 / 3; padding: 0; border: 0; background: none; border-radius: .4rem; cursor: pointer; transition: transform .12s; }
.match-card.piccola { --carta-l: 4.2rem; }
.match-card img { width: 100%; height: 100%; object-fit: cover; border-radius: .4rem; }
.match-card:hover { transform: scale(1.8); z-index: 20; }
.match-card.attenuata { opacity: .4; }
.match-card.evidenziata { box-shadow: 0 0 .6rem .15rem #ffd36b; }
.match-card.selezionata { box-shadow: 0 0 .7rem .25rem #6bd3ff; transform: translateY(-.5rem); }
.match-card__nome { display: grid; place-items: center; height: 100%; font-size: .7rem; background: #1b1f33; border-radius: .4rem; }
.match-card.coperta img { outline: 2px dashed #fff; outline-offset: -2px; }
.match-card__coperta { position: absolute; left: 0; right: 0; bottom: 0; font-size: .6rem; text-align: center; background: #000a; color: #fff; border-radius: 0 0 .4rem .4rem; }
.match-card__segnalino { position: absolute; top: .15rem; right: .15rem; font-size: .8rem; }
</style>
