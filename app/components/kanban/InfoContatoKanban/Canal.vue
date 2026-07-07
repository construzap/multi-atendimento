<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  idCanal: number | null
  canalNome: string | null
}>()

const display = computed(
  () => props.canalNome?.trim() || (props.idCanal ? `Canal #${props.idCanal}` : '—'),
)
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
      Canal
    </dt>
    <dd class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
      {{ display }}
    </dd>
  </div>
</template>
