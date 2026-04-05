<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import type { CanalCriado } from '~/stores/canais'

const props = defineProps<{
  open: boolean
  /** Workspace atual (rota /workspaces/[id]/canais) */
  workspaceId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  criado: [payload: CanalCriado]
}>()

const canaisStore = useCanaisStore()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const nome = ref('')
const descricao = ref('')

watch(isOpen, (aberto) => {
  if (!aberto) {
    nome.value = ''
    descricao.value = ''
  }
})

/** Mensagem do Nitro/ofetch em erros HTTP (403 assinatura, workspace, etc.). */
function mensagemErroApi(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const data = o.data as Record<string, unknown> | undefined
    if (data) {
      if (typeof data.statusMessage === 'string' && data.statusMessage) return data.statusMessage
      if (typeof data.message === 'string' && data.message) return data.message
    }
    if (typeof o.statusMessage === 'string' && o.statusMessage) return o.statusMessage
    if (typeof o.message === 'string' && o.message && !o.message.startsWith('[')) return o.message
  }
  if (err instanceof Error && err.message) return err.message
  return 'Não foi possível criar o canal.'
}

function close() {
  isOpen.value = false
}

async function onCreate() {
  const n = nome.value.trim()
  const d = descricao.value.trim()

  if (!n) {
    toast.warning('Informe o nome do canal.')
    return
  }

  if (!Number.isFinite(props.workspaceId)) {
    toast.error('Workspace inválido.')
    return
  }

  try {
    const created = await canaisStore.create({
      nome: n,
      descricao: d || null,
      workspace_id: props.workspaceId
    })
    toast.success('Canal criado com sucesso.')
    emit('criado', created)
    close()
  } catch (err: unknown) {
    const msg = mensagemErroApi(err)
    toast.error(msg, {
      duration: 8000
    })
  }
}
</script>

<template>
  <BaseModal v-model:open="isOpen" title="Criar canal">
    <template #icon>
      <FontAwesomeIcon :icon="faWhatsapp" class="h-6 w-6 text-[#25D366]" aria-hidden="true" />
    </template>
    <template #subtitle> Preencha os dados do canal de atendimento. </template>

    <div class="space-y-4">
      <div>
        <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="canal-nome">
          Nome
        </label>
        <BaseInput
          id="canal-nome"
          v-model="nome"
          type="text"
          name="canal_nome"
          placeholder="Ex: Atendimento comercial"
          autocomplete="off"
        />
      </div>

      <div>
        <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="canal-descricao">
          Descrição
        </label>
        <textarea
          id="canal-descricao"
          v-model="descricao"
          name="canal_descricao"
          rows="4"
          placeholder="Descreva o uso deste canal..."
          class="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70"
        />
      </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" @click="close">Cancelar</BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton
          type="button"
          :disabled="!nome.trim() || canaisStore.pending"
          @click="onCreate"
        >
          Criar canal
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
