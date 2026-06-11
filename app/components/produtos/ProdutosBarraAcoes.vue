<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'

const emit = defineEmits<{
  exportar: []
  importar: []
  novo: []
}>()

const workspacesStore = useWorkspacesStore()
const { currentWorkspaceId } = storeToRefs(workspacesStore)

const workspaceId = computed((): number | null => {
  const raw = currentWorkspaceId.value
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const enviandoIa = ref(false)
const modalIaIniciadaAberto = ref(false)

async function enviarParaIa() {
  const wid = workspaceId.value
  if (wid == null || wid < 1) {
    toast.error('Workspace inválido.')
    return
  }
  if (enviandoIa.value) return

  enviandoIa.value = true
  try {
    await $fetch('/api/produtos/enviar-ia', {
      method: 'POST',
      body: { workspace_id: wid },
    })
    modalIaIniciadaAberto.value = true
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível iniciar a importação por I.A.'))
  } finally {
    enviandoIa.value = false
  }
}

function fecharModalIaIniciada() {
  modalIaIniciadaAberto.value = false
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
      :disabled="enviandoIa"
      @click="enviarParaIa"
    >
      <span class="inline-flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">smart_toy</span>
        {{ enviandoIa ? 'A enviar…' : 'Enviar para I.A.' }}
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

    <ModalAlerta
      v-model:open="modalIaIniciadaAberto"
      title="Importação iniciada"
      texto="A importação foi iniciada. Acesse o WhatsApp no número de notificações para acompanhar o processo."
      variante="info"
      texto-confirmar="Entendi"
      :mostrar-cancelar="false"
      :mostrar-fechar="true"
      @confirmar="fecharModalIaIniciada"
    />
  </div>
</template>
