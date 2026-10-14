<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchStore } from '../stores/matchStore'
import MatchLobby from '../components/match/MatchLobby.vue'
import MatchTable from '../components/match/MatchTable.vue'

const route = useRoute()
const match = useMatchStore()
const codice = computed( () => ( typeof route.params.codice === 'string' ? route.params.codice : null ) )
const alTavolo = computed( () => !!match.agg && match.agg.statoTavolo !== 'attesa' && match.agg.codice === codice.value )

onMounted( () => match.connetti() )
onBeforeUnmount( () => match.disconnetti() )
</script>

<template>
  <main class="match-view">
    <MatchTable v-if="alTavolo" />
    <MatchLobby v-else :key="codice ?? 'nuova'" :codice="codice" />
  </main>
</template>
