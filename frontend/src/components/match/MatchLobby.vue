<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchStore } from '../../stores/matchStore'
import { useDeckStore } from '../../stores/deckStore'

const props = defineProps<{ codice: string | null }>()
const match = useMatchStore()
const decks = useDeckStore()
const router = useRouter()

const scelto = ref<string | null>( null )
const serveMazzo = ref( props.codice === null )
const bloccante = ref<string | null>( null )
const copiato = ref( false )

const mazzi = computed( () => decks.userDecks.map( ( d ) => {
  const n = d.cards.reduce( ( t, c ) => t + c.count, 0 )
  return { id: String( d.id ), nome: d.name, n, valido: n === 40 && d.costruttoreId !== null }
} ) )

const linkInvito = computed( () => ( props.codice ? `${window.location.origin}/partita/${props.codice}` : '' ) )
const inAttesa = computed( () => match.agg?.statoTavolo === 'attesa' )

onMounted( async () => {
  // Il default del backend ne restituisce 12: la lobby li vuole tutti.
  await decks.fetchUserDecks( { limit: 50 } )
  if ( props.codice ) {
    const ok = await match.entra( props.codice )
    if ( !ok ) {
      if ( match.errore === 'Scegli un mazzo' ) serveMazzo.value = true
      else bloccante.value = match.errore
    }
  }
} )

async function crea() {
  if ( !scelto.value ) return
  const codice = await match.crea( scelto.value )
  if ( codice ) router.replace( `/partita/${codice}` )
}

async function entra() {
  if ( !scelto.value || !props.codice ) return
  if ( await match.entra( props.codice, scelto.value ) ) serveMazzo.value = false
}

async function copia() {
  try {
    await navigator.clipboard.writeText( linkInvito.value )
    copiato.value = true
  } catch {
    copiato.value = false
  }
}
</script>

<template>
  <section class="lobby">
    <h1>Partita online</h1>

    <div v-if="bloccante" class="lobby__errore">
      <p>{{ bloccante }}</p>
      <RouterLink to="/partita">Crea una nuova partita</RouterLink>
    </div>

    <div v-else-if="inAttesa" class="lobby__invito">
      <p>In attesa dell'avversario. Mandagli questo link:</p>
      <code>{{ linkInvito }}</code>
      <button type="button" @click="copia">{{ copiato ? 'Copiato' : 'Copia link' }}</button>
    </div>

    <div v-else-if="serveMazzo" data-test="scelta-mazzo">
      <p>Scegli il mazzo con cui giocare.</p>
      <ul class="lobby__mazzi">
        <li v-for="m in mazzi" :key="m.id">
          <button
            type="button"
            :data-test="`mazzo-${m.id}`"
            :disabled="!m.valido"
            :class="{ scelto: scelto === m.id }"
            @click="scelto = m.id"
          >
            {{ m.nome }}
            <small v-if="!m.valido">Mazzo incompleto: {{ m.n }} carte</small>
          </button>
        </li>
      </ul>
      <button v-if="codice === null" type="button" data-test="crea" :disabled="!scelto" @click="crea">Crea partita</button>
      <button v-else type="button" data-test="entra" :disabled="!scelto" @click="entra">Entra nella partita</button>
      <p v-if="match.errore && match.errore !== 'Scegli un mazzo'" class="lobby__errore">{{ match.errore }}</p>
    </div>
  </section>
</template>

<style scoped>
.lobby { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
.lobby__mazzi { list-style: none; padding: 0; display: grid; gap: .5rem; }
.lobby__mazzi button { width: 100%; text-align: left; padding: .75rem 1rem; }
.lobby__mazzi button.scelto { outline: 2px solid currentColor; }
.lobby__mazzi small { display: block; opacity: .7; }
.lobby__errore { color: #ff6b6b; }
.lobby__invito code { display: block; margin: .5rem 0; word-break: break-all; }
</style>
