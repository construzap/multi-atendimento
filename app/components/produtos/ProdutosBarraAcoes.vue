<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import ModalAdminCriarImagens from '~/components/produtos/ModalAdminCriarImagens.vue'
import { useProfileStore } from '~/stores/profile'
import { useWorkspacesStore } from '~/stores/workspaces'

withDefaults(
  defineProps<{
    /** Esconde o botão Novo (ex.: painel com «Adicionar item» próprio). */
    ocultarNovo?: boolean
  }>(),
  {
    ocultarNovo: false,
  },
)

const emit = defineEmits<{
  exportar: []
  importar: []
  novo: []
}>()

const workspacesStore = useWorkspacesStore()
const { currentWorkspaceId } = storeToRefs(workspacesStore)
const profileStore = useProfileStore()
const { isAdminConfirmado } = storeToRefs(profileStore)

const modalCriarImagensAberto = ref(false)

const workspaceId = computed((): number | null => {
  const raw = currentWorkspaceId.value
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const vectorStorePath = computed(() => {
  const wid = workspaceId.value
  return wid != null ? `/workspaces/${wid}/produtos/enviar-para-ia/vector-store` : null
})

async function enviarParaIa() {
  const path = vectorStorePath.value
  if (!path) {
    toast.error('Workspace inválido.')
    return
  }
  await navigateTo(path)
}

function abrirCriarImagens() {
  modalCriarImagensAberto.value = true
}
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

    <BaseButton
      variant="secondary"
      :block="false"
      size="md"
      type="button"
      @click="enviarParaIa"
    >
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">smart_toy</span>
        Enviar para I.A.
      </span>
    </BaseButton>

    <BaseButton
      v-if="isAdminConfirmado"
      variant="secondary"
      :block="false"
      size="md"
      type="button"
      @click="abrirCriarImagens"
    >
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">image</span>
        Criar imagens
      </span>
    </BaseButton>

    <BaseButton
      v-if="!ocultarNovo"
      variant="primary"
      :block="false"
      size="md"
      type="button"
      @click="emit('novo')"
    >
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1" aria-hidden="true">
          add_circle
        </span>
        Novo
      </span>
    </BaseButton>

    <ModalAdminCriarImagens v-if="isAdminConfirmado" v-model:open="modalCriarImagensAberto" />
  </div>
</template>
