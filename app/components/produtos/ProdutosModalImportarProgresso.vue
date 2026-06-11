<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'

/**
 * Categorias (pesquisar / criar / uma por produto): `~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue`.
 * (usado na tabela de produtos e no modal «Novo produto»). Este modal só mostra o progresso da importação.
 */

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    /** true enquanto lê o ficheiro ou envia lotes */
    emAndamento: boolean
    /** Linhas já enviadas (contagem acumulada do cliente) */
    processadas: number
    /** Total de linhas válidas a enviar */
    total: number
    /** Fase curta para o subtítulo */
    fase: 'idle' | 'lendo' | 'enviando' | 'concluido' | 'erro'
    mensagemErro?: string | null
  }>(),
  {
    mensagemErro: null,
  },
)

const emit = defineEmits<{
  fechar: []
}>()

const podeFechar = computed(() => !props.emAndamento)

const percentual = computed(() => {
  if (props.total <= 0) return 0
  return Math.min(100, Math.round((props.processadas / props.total) * 100))
})

const tituloModal = computed(() => {
  if (props.fase === 'erro') return 'Erro na importação'
  if (props.fase === 'concluido') return 'Importação concluída'
  return 'A importar produtos'
})

const subtitulo = computed(() => {
  if (props.fase === 'lendo') return 'A ler o ficheiro e a preparar os dados…'
  if (props.fase === 'enviando') return 'A enviar em lotes para o servidor. Não feche esta janela.'
  if (props.fase === 'concluido') return 'Os produtos foram gravados. A lista foi atualizada.'
  if (props.fase === 'erro') return props.mensagemErro ?? 'Ocorreu um erro.'
  return ''
})

function fechar() {
  emit('fechar')
  open.value = false
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="tituloModal"
    :show-close="podeFechar"
    :close-on-backdrop="podeFechar"
    :close-on-escape="podeFechar"
    panel-class="w-full max-w-md"
  >
    <template #subtitle>
      <span class="block leading-relaxed">{{ subtitulo }}</span>
    </template>

    <div class="space-y-4">
      <div v-if="fase === 'enviando' || fase === 'lendo'" class="space-y-2">
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high dark:bg-dark-surface-container-high">
          <div
            class="h-full rounded-full bg-primary-600 transition-[width] duration-300 dark:bg-dark-primary"
            :style="{ width: fase === 'lendo' ? '12%' : `${percentual}%` }"
          />
        </div>
        <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          <template v-if="total > 0">{{ processadas }} / {{ total }} linhas</template>
          <template v-else>A preparar…</template>
        </p>
      </div>

      <div
        v-else-if="fase === 'concluido'"
        class="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-950/30 dark:text-emerald-100"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">check_circle</span>
        <span>Foram importados {{ total }} produto(s).</span>
      </div>

      <div
        v-else-if="fase === 'erro'"
        class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-on-surface dark:text-dark-on-surface"
      >
        {{ mensagemErro }}
      </div>
    </div>

    <template #footer>
      <BaseButton
        v-if="podeFechar"
        type="button"
        variant="primary"
        :block="false"
        @click="fechar"
      >
        OK
      </BaseButton>
    </template>
  </BaseModal>
</template>
