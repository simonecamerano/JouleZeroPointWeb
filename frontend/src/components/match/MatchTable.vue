<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMatchStore } from '../../stores/matchStore'
import { useCardStore } from '../../stores/cardStore'
import type { PlayerId } from '../../types/match'
import MatchCard from './MatchCard.vue'
import MatchColumn from './MatchColumn.vue'
import MatchDecisionPanel from './MatchDecisionPanel.vue'
import MatchHand from './MatchHand.vue'
import MatchLog from './MatchLog.vue'
import MatchManualPanel from './MatchManualPanel.vue'
import MatchPile from './MatchPile.vue'
import MatchStatusBar from './MatchStatusBar.vue'
import MatchThermometer from './MatchThermometer.vue'

const match = useMatchStore()
const cards = useCardStore()
onMounted( () => cards.fetchCards() )

const v = computed( () => match.vista! )
const io = computed<PlayerId>( () => match.agg!.ruolo )
const lui = computed<PlayerId>( () => ( io.value === 'A' ? 'B' : 'A' ) )
const g = ( p: PlayerId ) => v.value.giocatori[p]
const cima = ( arr: { cardId: number }[] ) => ( arr.length ? arr[arr.length - 1].cardId : null )

// Ultimo uid cliccato sul tavolo (colonne, stack, mano durante un effetto manuale): bersaglio del pannello manuale.
const bersaglio = ref<string | null>( null )

function cartaCliccata( uid: string ) {
  if ( match.bersagli.includes( uid ) ) {
    match.invia( { tipo: 'rispondi', risposta: uid } )
    return
  }
  const d = v.value.decisione
  if ( match.tocca && d?.tipo === 'capienza' ) {
    match.invia( { tipo: 'capienza', distruggi: uid } )
    return
  }
  bersaglio.value = uid
}
</script>

<template>
  <section class="tavolo">
    <MatchStatusBar class="tavolo__barra" />

    <div data-test="mano-avversario" class="tavolo__mano-avv">
      <MatchCard piccola :card-id="null" coperta />
      <span>× {{ g(lui).carteInMano }}</span>
    </div>

    <div class="tavolo__griglia">
      <MatchPile class="g-orizzonte-a" titolo="Orizzonte" :cima="cima(g(lui).orizzonte)" :conteggio="g(lui).orizzonte.length" />
      <MatchPile class="g-memoria-a" titolo="Memoria" :cima="cima(g(lui).memoria)" :conteggio="g(lui).memoria.length" />
      <div class="g-centro-sx">
        <MatchPile
          titolo="Anomalia" :cima="v.anomalia?.cardId ?? null" :conteggio="v.anomalia ? 1 : 0" :uid="v.anomalia?.uid"
          :evidenziata="!!v.anomalia && match.bersagli.includes(v.anomalia.uid)" @click="v.anomalia && cartaCliccata(v.anomalia.uid)"
        />
        <MatchThermometer :tp="v.tp" :flusso="v.flusso" />
      </div>
      <MatchColumn class="g-passato" colonna="passato" :carte="v.colonne.passato" @carta="cartaCliccata" />
      <MatchColumn class="g-presente" colonna="presente" :carte="v.colonne.presente" @carta="cartaCliccata" />
      <MatchColumn class="g-futuro" colonna="futuro" :carte="v.colonne.futuro" @carta="cartaCliccata" />
      <MatchPile class="g-costr-a" titolo="Costruttore" :uid="g(lui).costruttore.uid" :cima="g(lui).costruttore.cardId" :conteggio="1" />
      <MatchPile class="g-mazzo-a" titolo="Futuro" :cima="null" coperta :conteggio="g(lui).carteFuturo" />
      <MatchPile class="g-orizzonte-b" mia titolo="Orizzonte" :cima="cima(g(io).orizzonte)" :conteggio="g(io).orizzonte.length" />
      <MatchPile class="g-memoria-b" mia titolo="Memoria" :cima="cima(g(io).memoria)" :conteggio="g(io).memoria.length" />
      <MatchPile class="g-costr-b" mia titolo="Costruttore" :uid="g(io).costruttore.uid" :cima="g(io).costruttore.cardId" :conteggio="1" />
      <MatchPile class="g-mazzo-b" mia titolo="Futuro" :cima="null" coperta :conteggio="g(io).carteFuturo" />
    </div>

    <div v-if="v.stack.length" data-test="stack" class="tavolo__stack">
      <span class="tavolo__stack-titolo">Risposte in corso</span>
      <MatchCard
        v-for="voce in v.stack"
        :key="voce.uid"
        :data-uid="voce.uid"
        piccola
        :card-id="voce.cardId"
        :coperta="voce.cardId === null"
        :uid="voce.uid"
        :attenuata="voce.annullata"
        :evidenziata="match.bersagli.includes(voce.uid)"
        :class="voce.controllore === io ? 'mia' : 'avversario'"
        :title="voce.annullata ? 'Annullata' : undefined"
        @click="cartaCliccata(voce.uid)"
      />
    </div>

    <MatchHand class="tavolo__mano" :carte="g(io).mano ?? []" @carta="cartaCliccata" />
    <div data-test="area-pannello" class="tavolo__pannello">
      <MatchDecisionPanel />
      <MatchManualPanel :bersaglio="bersaglio" />
    </div>
    <MatchLog class="tavolo__log" :voci="v.log" />

    <p class="tavolo__ruota">Ruota il dispositivo in orizzontale per giocare.</p>
  </section>
</template>

<style scoped>
.tavolo {
  display: grid; gap: .5rem; padding: .5rem; min-height: 100vh;
  grid-template-columns: 1fr 16rem; grid-template-rows: auto auto 1fr auto auto auto;
  grid-template-areas: 'barra barra' 'manoavv log' 'griglia log' 'stack log' 'pannello log' 'mano log';
  background: radial-gradient(ellipse at center, #10142a, #04050b);
}
.tavolo__barra { grid-area: barra; }
.tavolo__mano-avv { grid-area: manoavv; display: flex; align-items: center; justify-content: center; gap: .5rem; }
.tavolo__mano { grid-area: mano; }
.tavolo__pannello { grid-area: pannello; display: flex; flex-direction: column; gap: .5rem; }
.tavolo__stack { grid-area: stack; display: flex; align-items: center; justify-content: center; gap: .4rem; padding: .3rem; background: #0b0e1acc; border-radius: .5rem; }
.tavolo__stack-titolo { font-size: .65rem; text-transform: uppercase; letter-spacing: .05em; opacity: .8; }
.tavolo__stack .avversario :deep(img) { outline: 2px solid #f6ad55; }
.tavolo__stack .mia :deep(img) { outline: 2px solid #4fd1c5; }
.tavolo__log { grid-area: log; max-height: calc(100vh - 4rem); }
.tavolo__griglia {
  grid-area: griglia; display: grid; gap: .5rem; min-height: 32rem;
  grid-template-columns: auto auto auto 1fr 1fr 1fr auto auto;
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    'orizA memA centro passato presente futuro costrA mazzoA'
    'orizB memB centro passato presente futuro costrB mazzoB';
}
.g-orizzonte-a { grid-area: orizA; } .g-memoria-a { grid-area: memA; }
.g-orizzonte-b { grid-area: orizB; } .g-memoria-b { grid-area: memB; }
.g-centro-sx { grid-area: centro; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; }
.g-passato { grid-area: passato; } .g-presente { grid-area: presente; } .g-futuro { grid-area: futuro; }
.g-costr-a { grid-area: costrA; } .g-mazzo-a { grid-area: mazzoA; }
.g-costr-b { grid-area: costrB; } .g-mazzo-b { grid-area: mazzoB; }
.tavolo__ruota { display: none; }
@media (orientation: portrait) and (max-width: 767px) {
  .tavolo > :not(.tavolo__ruota) { display: none; }
  .tavolo { display: grid; place-items: center; }
  .tavolo__ruota { display: block; text-align: center; padding: 2rem; }
}
</style>
