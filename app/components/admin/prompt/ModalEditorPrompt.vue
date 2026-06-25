<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    salvando?: boolean
  }>(),
  {
    salvando: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: { titulo: string; conteudo: string; principal: boolean }]
  delete: []
}>()

const adminStore = useAdminStore()
const { promptEmEdicao } = storeToRefs(adminStore)

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const tituloModal = computed(() =>
  promptEmEdicao.value?.isNovo ? 'Novo prompt' : 'Editar prompt',
)

const titulo = ref('')
const conteudo = ref('')
const principal = ref(false)

watch(
  () => [props.open, promptEmEdicao.value] as const,
  ([aberto, p]) => {
    if (!aberto || !p) return
    titulo.value = p.titulo
    conteudo.value = p.conteudo
    principal.value = p.principal
  },
  { immediate: true },
)

function fechar() {
  isOpen.value = false
}

function salvar() {
  if (props.salvando) return
  emit('save', {
    titulo: titulo.value.trim() || 'Sem título',
    conteudo: conteudo.value,
    principal: principal.value,
  })
}

function excluir() {
  if (props.salvando || promptEmEdicao.value?.isNovo) return
  emit('delete')
}
</script>

<template>
  <BaseModal
    v-model:open="isOpen"
    :title="tituloModal"
    panel-class="w-full max-w-4xl"
  >
    <template #icon>
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path
          d="M9.5 7.5H14.5M9.5 11H13M7 3h10a2 2 0 0 1 2 2v14l-3.5-2-3.5 2-3.5-2-3.5 2V5a2 2 0 0 1 2-2z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </template>

    <template #subtitle>
      Defina o conteúdo e marque se é o prompt principal da IA
    </template>

    <div v-if="promptEmEdicao" class="space-y-5">
      <div class="space-y-2">
        <label
          for="modal-prompt-titulo"
          class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Título
        </label>
        <BaseInput
          id="modal-prompt-titulo"
          v-model="titulo"
          placeholder="Ex.: Atendimento padrão"
          :disabled="salvando"
        />
      </div>

      <div class="space-y-2">
        <label
          for="modal-prompt-conteudo"
          class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Conteúdo do prompt
        </label>
        <BaseTextarea
          id="modal-prompt-conteudo"
          v-model="conteudo"
          placeholder="Descreva como a IA deve se comportar, regras, tom de voz, contexto do negócio..."
          :min-height-px="420"
          :max-height-px="560"
          :submit-on-enter="false"
          :disabled="salvando"
          input-class="font-mono text-sm leading-relaxed"
        />
        <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ conteudo.length }} caracteres
        </p>
      </div>

      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border border-outline/40 bg-surface-container-high/50 p-4 transition-colors hover:border-primary-300 dark:border-dark-outline/40 dark:bg-dark-surface-container-high/40 dark:hover:border-primary-700"
      >
        <input
          v-model="principal"
          type="checkbox"
          class="mt-0.5 h-4 w-4 rounded border-outline text-primary-500 focus:ring-primary-500 dark:border-dark-outline"
          :disabled="salvando"
        />
        <span class="space-y-1">
          <span class="block text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            Definir como prompt principal
          </span>
          <span class="block text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            Apenas um prompt pode ser principal. Ele será usado como instrução base da IA neste workspace.
          </span>
        </span>
      </label>
    </div>

    <template #footer>
      <button
        v-if="promptEmEdicao && !promptEmEdicao.isNovo"
        type="button"
        class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-container/30 disabled:opacity-50 sm:w-auto dark:border-danger/40 dark:text-dark-danger"
        :disabled="salvando"
        @click="excluir"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Excluir
      </button>
      <BaseButton
        id="btn-modal-cancelar-prompt"
        variant="secondary"
        size="sm"
        :block="false"
        :disabled="salvando"
        @click="fechar"
      >
        Cancelar
      </BaseButton>
      <BaseButton
        id="btn-modal-salvar-prompt"
        variant="primary"
        size="sm"
        :block="false"
        :disabled="salvando"
        @click="salvar"
      >
        {{ salvando ? 'Salvando...' : 'Salvar prompt' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
