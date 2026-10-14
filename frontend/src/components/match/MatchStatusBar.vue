<script setup lang="ts">
import { computed } from 'vue'
import { useMatchStore } from '../../stores/matchStore'

const match = useMatchStore()
const v = computed( () => match.vista! )
const io = computed( () => v.value.giocatori[match.agg!.ruolo] )
const avv = computed( () => v.value.giocatori[match.agg!.ruolo === 'A' ? 'B' : 'A'] )
const FASI: Record<string, string> = {
  setup: 'Preparazione', slittamento: 'Slittamento', risorse: 'Risorse', azioni: 'Azioni',
  collisione: 'Collisione', fine: 'Fine round', terminata: 'Terminata',
}
</script>

<template>
  <div data-test="barra-stato" class="barra">
    <strong v-if="!match.connesso" data-test="connessione-persa" class="barra__avviso">Connessione persa, riconnessione…</strong>
    <strong v-if="match.errore" data-test="errore-tavolo" class="barra__avviso">{{ match.errore }}</strong>
    <span>Round {{ v.round }}</span>
    <span>{{ FASI[v.fase] }}</span>
    <span>{{ v.flusso === 'normale' ? 'Normale' : 'Invertito' }}</span>
    <span>TP {{ v.tp > 0 ? '+' : '' }}{{ v.tp }}</span>
    <span>Tu: IT {{ io.it }} · ET {{ io.et }}/{{ io.etMax }}</span>
    <span>{{ match.agg!.avversario }}: IT {{ avv.it }} · ET {{ avv.et }}/{{ avv.etMax }}</span>
    <span>{{ v.iniziativa === match.agg!.ruolo ? 'Hai l\'iniziativa' : 'Iniziativa all\'avversario' }}</span>
    <strong v-if="match.agg!.statoTavolo === 'pausa'" class="barra__pausa">Partita in pausa: avversario assente</strong>
    <strong v-else-if="match.tocca" class="barra__tocca">Tocca a te</strong>
    <span v-else>Tocca all'avversario</span>
  </div>
</template>

<style scoped>
.barra { display: flex; flex-wrap: wrap; gap: .4rem 1rem; align-items: center; padding: .4rem .8rem; font-size: .85rem; background: #0b0e1acc; border-radius: .5rem; }
.barra__tocca { color: #1a1300; background: #ffd36b; padding: .1rem .6rem; border-radius: .3rem; }
.barra__avviso { flex-basis: 100%; color: #ff6b6b; }
.barra__pausa { color: #ff6b6b; }
</style>
