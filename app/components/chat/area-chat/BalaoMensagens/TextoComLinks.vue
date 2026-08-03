<script setup lang="ts">
import { computed } from 'vue'
import { segmentarTextoComLinks } from '~/utils/segmentarTextoComLinks'

const props = withDefaults(
  defineProps<{
    texto: string
    /** Classes do container (ex.: tipografia do balão). */
    class?: string
    /** Classes dos links (default: underline + cor herdada). */
    linkClass?: string
  }>(),
  {
    linkClass: 'underline underline-offset-2 break-all hover:opacity-90',
  },
)

const segmentos = computed(() => segmentarTextoComLinks(props.texto))
</script>

<template>
  <span :class="props.class">
    <template v-for="(seg, i) in segmentos" :key="i">
      <a
        v-if="seg.type === 'link'"
        :href="seg.href"
        target="_blank"
        rel="noopener noreferrer"
        :class="linkClass"
        @click.stop
      >
        {{ seg.value }}
      </a>
      <template v-else>{{ seg.value }}</template>
    </template>
  </span>
</template>
