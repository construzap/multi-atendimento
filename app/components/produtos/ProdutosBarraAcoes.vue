<script setup lang="ts">
import BaseButton from '~/components/BaseButton.vue'

const emit = defineEmits<{
  exportar: []
  importar: []
  novo: []
}>()
</script>

<template>
  <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
    <BaseButton variant="success" :block="false" size="md" type="button" @click="emit('importar')">
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">file_upload</span>
        Importar
      </span>
    </BaseButton>

    <BaseButton variant="info" :block="false" size="md" type="button" @click="emit('exportar')">
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">file_download</span>
        Exportar
      </span>
    </BaseButton>

    <BaseButton variant="primary" :block="false" size="md" type="button" @click="emit('novo')">
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1" aria-hidden="true">
          add_circle
        </span>
        Novo
      </span>
    </BaseButton>
  </div>
</template>
