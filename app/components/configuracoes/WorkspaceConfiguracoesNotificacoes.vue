<script setup lang="ts">
import { computed } from 'vue'
import {
  MENSAGEM_DESTINO_NOTIFICACAO_INVALIDO,
  PATTERN_DESTINO_NOTIFICACAO,
} from '#shared/utils/validarDestinoNotificacao'
import BaseInput from '~/components/BaseInput.vue'
import { useConfiguracoesStore } from '~/stores/configuracoes'

const route = useRoute()
const workspaces = useWorkspacesStore()
const configuracoes = useConfiguracoesStore()

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const carregando = computed(() => {
  const id = workspaceId.value
  return id != null && configuracoes.carregando(id)
})

const desabilitado = computed(() => carregando.value || configuracoes.salvando)

const numeroNotificacao = computed({
  get: () => {
    const id = workspaceId.value
    return id != null ? configuracoes.doWorkspace(id)?.numero_notificacao ?? '' : ''
  },
  set: (v: string) => {
    const id = workspaceId.value
    if (id != null) configuracoes.atualizarCampo(id, 'numero_notificacao', v)
  },
})
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
  >
    <div class="border-b border-outline/40 p-6 dark:border-dark-outline/40">
      <div>
        <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
          Notificações
        </h3>
        <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Número que receberá aviso quando a IA finalizar um atendimento
        </p>
      </div>
    </div>

    <div class="p-6">
      <div
        v-if="!workspaceId"
        class="rounded-xl border border-outline/40 bg-surface-container-low p-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
      >
        Workspace não encontrado no estado atual.
      </div>

      <div
        v-else
        :class="{ 'pointer-events-none opacity-60': desabilitado }"
      >
        <label
          class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
          for="ws-config-notificacao-telefone"
        >
          Número para notificação
        </label>
        <p class="mb-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          A IA enviará uma mensagem ao concluir o atendimento. Aceita telefone (ex.: 557199293684) ou grupo WhatsApp (ex.: 120363424086989112@g.us).
        </p>
        <BaseInput
          id="ws-config-notificacao-telefone"
          v-model="numeroNotificacao"
          type="text"
          name="numero_notificacao"
          autocomplete="off"
          :pattern="PATTERN_DESTINO_NOTIFICACAO"
          :maxlength="64"
          placeholder="557199293684 ou 120363424086989112@g.us"
          :title="MENSAGEM_DESTINO_NOTIFICACAO_INVALIDO"
          :invalid-message="MENSAGEM_DESTINO_NOTIFICACAO_INVALIDO"
          :disabled="desabilitado"
        >
          <template #leading>
            <svg class="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
              />
            </svg>
          </template>
        </BaseInput>
      </div>
    </div>
  </section>
</template>
