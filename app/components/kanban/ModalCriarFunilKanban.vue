<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { KanbanCriarFunilResponse } from '#shared/types/kanban'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  criado: [payload: KanbanCriarFunilResponse]
}>()

const workspacesStore = useWorkspacesStore()

const nome = ref('')
const salvando = ref(false)

watch(
  () => props.open,
  (aberto) => {
    if (aberto) nome.value = ''
    else salvando.value = false
  },
)

function fechar() {
  emit('update:open', false)
}

function resolverWorkspaceId(): number | null {
  const raw = workspacesStore.currentWorkspaceId
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function confirmar() {
  const nomeTrim = nome.value.trim()
  if (!nomeTrim) {
    toast.error('Informe o nome do funil.')
    return
  }

  const workspaceId = resolverWorkspaceId()
  if (workspaceId == null) {
    toast.error('Workspace não identificado.')
    return
  }

  salvando.value = true
  try {
    const res = await $fetch<KanbanCriarFunilResponse>('/api/kanban/funil', {
      method: 'POST',
      body: {
        workspace_id: workspaceId,
        nome: nomeTrim,
      },
    })
    toast.success('Funil criado com sucesso.')
    emit('criado', res)
    fechar()
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível criar o funil.'), { duration: 8000 })
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Novo funil"
    :show-close="!salvando"
    panel-class="w-full max-w-md"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4">
      <div>
        <label
          class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface"
          for="kanban-novo-funil-nome"
        >
          Nome do funil
        </label>
        <BaseInput
          id="kanban-novo-funil-nome"
          v-model="nome"
          name="kanban-novo-funil-nome"
          placeholder="Ex.: Funil Comercial"
          autocomplete="off"
          :disabled="salvando"
          @keydown.enter.prevent="confirmar"
        />
      </div>
    </div>

    <template #footer>
      <BaseButton
        variant="secondary"
        size="sm"
        :block="false"
        :disabled="salvando"
        @click="fechar"
      >
        Cancelar
      </BaseButton>
      <BaseButton
        variant="primary"
        size="sm"
        :block="false"
        :loading="salvando"
        :disabled="salvando || !nome.trim()"
        @click="confirmar"
      >
        Criar funil
      </BaseButton>
    </template>
  </BaseModal>
</template>
