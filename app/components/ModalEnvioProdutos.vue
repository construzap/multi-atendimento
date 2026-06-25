<script setup lang="ts">
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    title?: string
    total?: number
    enviados?: number
    erro?: string | null
    podeCancelar?: boolean
  }>(),
  {
    title: 'Enviando produtos…',
    total: 0,
    enviados: 0,
    erro: null,
    podeCancelar: true,
  },
)

const emit = defineEmits<{
  cancelar: []
}>()

const pct = computed(() => {
  const total = props.total ?? 0
  const enviados = props.enviados ?? 0
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((enviados / total) * 100)))
})
</script>

<template>
  <BaseModal v-model:open="open" :title="title" panel-class="w-full max-w-lg" :show-close="false" :close-on-backdrop="false">
    <div class="space-y-4">
      <div class="flex items-center justify-between text-sm">
        <p class="font-medium text-on-surface dark:text-dark-on-surface">
          {{ enviados }} / {{ total }}
        </p>
        <p class="text-on-surface-variant dark:text-dark-on-surface-variant">{{ pct }}%</p>
      </div>

      <div class="h-2 w-full overflow-hidden rounded-full bg-surface-container-high dark:bg-dark-surface-container-high">
        <div
          class="h-full rounded-full bg-primary-600 transition-[width] duration-300 ease-out dark:bg-primary-500"
          :style="{ width: pct + '%' }"
        />
      </div>

      <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        {{ erro }}
      </p>

      <slot name="extra" />
    </div>

    <template #footer>
      <BaseButton
        v-if="podeCancelar"
        type="button"
        variant="secondary"
        :block="false"
        @click="emit('cancelar')"
      >
        Cancelar
      </BaseButton>
    </template>
  </BaseModal>
</template>

