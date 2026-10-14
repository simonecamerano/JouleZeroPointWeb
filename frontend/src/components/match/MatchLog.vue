<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
const props = defineProps<{ voci: { round: number; testo: string }[] }>()
const box = ref<HTMLElement | null>( null )
watch( () => props.voci.length, async () => {
  await nextTick()
  if ( box.value ) box.value.scrollTop = box.value.scrollHeight
} )
</script>

<template>
  <aside ref="box" data-test="registro" class="registro" aria-live="polite">
    <p v-for="( v, i ) in voci" :key="i"><small>R{{ v.round }}</small> {{ v.testo }}</p>
  </aside>
</template>

<style scoped>
.registro { overflow-y: auto; font-size: .78rem; padding: .5rem; background: #0b0e1acc; border-radius: .5rem; }
.registro p { margin: 0 0 .3rem; }
.registro small { opacity: .6; margin-right: .3rem; }
</style>
