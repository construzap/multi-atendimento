<script setup lang="ts">
import { computed } from 'vue'
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

const SEGUNDOS_POR_HORA = 3600
const PAUSA_PADRAO_SEGUNDOS = 28800

function parseInteiroPositivo(raw: string, padrao: number): number {
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 0) return padrao
  return n
}

function segundosParaHoras(segundos: number): string {
  const horas = segundos / SEGUNDOS_POR_HORA
  return Number.isInteger(horas) ? String(horas) : String(Math.round(horas * 100) / 100)
}

function horasParaSegundos(raw: string, padraoSegundos: number): number {
  const horas = Number.parseFloat(raw.trim().replace(',', '.'))
  if (!Number.isFinite(horas) || horas < 0) return padraoSegundos
  return Math.round(horas * SEGUNDOS_POR_HORA)
}

const tempoResposta = computed({
  get: () => {
    const id = workspaceId.value
    return id != null ? String(configuracoes.doWorkspace(id)?.tempo_resposta ?? 10) : '10'
  },
  set: (v: string) => {
    const id = workspaceId.value
    if (id != null) {
      configuracoes.atualizarCampo(id, 'tempo_resposta', parseInteiroPositivo(v, 10))
    }
  },
})

const tempoPausaHoras = computed({
  get: () => {
    const id = workspaceId.value
    const segundos =
      id != null ? configuracoes.doWorkspace(id)?.tempo_pausa ?? PAUSA_PADRAO_SEGUNDOS : PAUSA_PADRAO_SEGUNDOS
    return segundosParaHoras(segundos)
  },
  set: (v: string) => {
    const id = workspaceId.value
    if (id != null) {
      configuracoes.atualizarCampo(
        id,
        'tempo_pausa',
        horasParaSegundos(v, PAUSA_PADRAO_SEGUNDOS),
      )
    }
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
          Tempos da IA
        </h3>
        <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Tempo de resposta em segundos e tempo de pausa em horas.
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
        class="grid gap-5 sm:grid-cols-2"
        :class="{ 'pointer-events-none opacity-60': desabilitado }"
      >
        <div>
          <label
            class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
            for="ws-config-tempo-resposta"
          >
            Tempo de resposta
          </label>
          <p class="mb-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Aguardo antes de a IA responder (segundos).
          </p>
          <BaseInput
            id="ws-config-tempo-resposta"
            v-model="tempoResposta"
            type="number"
            name="tempo_resposta"
            inputmode="numeric"
            min="0"
            step="1"
            autocomplete="off"
            :disabled="desabilitado"
          />
        </div>

        <div>
          <label
            class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
            for="ws-config-tempo-pausa"
          >
            Tempo de pausa
          </label>
          <p class="mb-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Intervalo de pausa entre ciclos de atendimento (horas).
          </p>
          <BaseInput
            id="ws-config-tempo-pausa"
            v-model="tempoPausaHoras"
            type="number"
            name="tempo_pausa_horas"
            inputmode="decimal"
            min="0"
            step="0.5"
            autocomplete="off"
            :disabled="desabilitado"
          />
        </div>
      </div>
    </div>
  </section>
</template>
