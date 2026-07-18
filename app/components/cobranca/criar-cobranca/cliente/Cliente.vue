<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Canal } from '#shared/types/canal'
import type { Conversa, ConversasListResponse } from '#shared/types/conversa'
import {
  extrairDigitosTelefone,
  normalizeTelefoneBrParaEnvio,
} from '#shared/utils/normalizeWhatsappBr'
import { useCanaisStore } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'
import ModalCriaconversa from './ModalCriaconversa.vue'

const conversaKey = defineModel<string>('clienteSelecionado', { required: true })
const canalSelecionado = defineModel<number>('canalSelecionado', { required: true })
const clienteNome = defineModel<string>('clienteNome', { default: '' })
const clienteTelefone = defineModel<string>('clienteTelefone', { default: '' })

const workspaces = useWorkspacesStore()
const canaisStore = useCanaisStore()

const workspaceId = computed<number | null>(() => {
  const raw = workspaces.currentWorkspaceId
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
})

const canais = computed<Canal[]>(() => canaisStore.items)
const carregandoCanais = ref(false)
const erroCanais = ref<string | null>(null)

const temCanalSelecionado = computed(
  () => Number.isFinite(canalSelecionado.value) && canalSelecionado.value > 0,
)

async function carregarCanais() {
  const wid = workspaceId.value
  if (wid == null) {
    erroCanais.value = 'Workspace não identificado.'
    return
  }
  carregandoCanais.value = true
  erroCanais.value = null
  try {
    await canaisStore.ensureCanaisLoaded(wid)
  } catch {
    erroCanais.value = 'Não foi possível carregar os canais.'
  } finally {
    carregandoCanais.value = false
  }
}

const termoBusca = ref('')
const resultados = ref<Conversa[]>([])
const buscando = ref(false)
const erroBusca = ref<string | null>(null)
const buscou = ref(false)

const modalCriarAberto = ref(false)

const semResultados = computed(
  () => temCanalSelecionado.value && buscou.value && !buscando.value && !erroBusca.value && resultados.value.length === 0,
)

const temClienteSelecionado = computed(() => Boolean(conversaKey.value?.trim()))

const clienteVisivelNosResultados = computed(() =>
  resultados.value.some((c) => c.key === conversaKey.value),
)

function limparSelecaoCliente() {
  conversaKey.value = ''
  clienteNome.value = ''
  clienteTelefone.value = ''
  resultados.value = []
  buscou.value = false
  erroBusca.value = null
  termoBusca.value = ''
  modalCriarAberto.value = false
}

function termoBuscaNormalizado(raw: string): string {
  const termo = raw.trim()
  if (!termo) return ''

  const digitos = extrairDigitosTelefone(termo)
  // Se o usuário digitou algo que parece telefone, normaliza (DDI 55 + 9º dígito).
  if (digitos.length >= 8 && digitos.length / termo.replace(/\s/g, '').length >= 0.6) {
    return normalizeTelefoneBrParaEnvio(termo) || termo
  }

  return termo
}

async function pesquisarConversas() {
  if (!temCanalSelecionado.value) {
    erroBusca.value = 'Selecione o canal de envio antes de buscar o cliente.'
    return
  }

  const termo = termoBuscaNormalizado(termoBusca.value)
  const wid = workspaceId.value
  if (wid == null) {
    erroBusca.value = 'Workspace não identificado.'
    return
  }

  buscando.value = true
  erroBusca.value = null
  buscou.value = true
  try {
    const resposta = await $fetch<ConversasListResponse>('/api/cobranca/conversas', {
      method: 'GET',
      query: {
        workspace_id: wid,
        id_canal: canalSelecionado.value,
        ...(termo ? { q: termo } : {}),
      },
    })
    resultados.value = resposta.data
  } catch {
    resultados.value = []
    erroBusca.value = 'Não foi possível buscar conversas.'
  } finally {
    buscando.value = false
  }
}

function selecionarConversa(conversa: Conversa) {
  conversaKey.value = conversa.key
  clienteNome.value = conversa.name ?? ''
  clienteTelefone.value = conversa.phone ?? ''
}

function abrirCriarConversa() {
  modalCriarAberto.value = true
}

function onConversaCriada(conversa: Conversa) {
  resultados.value = [conversa]
  selecionarConversa(conversa)
  buscou.value = true
  erroBusca.value = null
}

const inputClass =
  'w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2.5 font-body text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20'

watch(canalSelecionado, (novo, antigo) => {
  // Evita limpar ao hidratar edição (0 -> canal). Só limpa troca real de canal.
  if (antigo && antigo > 0 && novo !== antigo) limparSelecaoCliente()
})

onMounted(() => {
  void carregarCanais()
})
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <p class="font-label text-sm font-semibold uppercase tracking-wide text-primary dark:text-dark-primary">
        Passo 1
      </p>
      <h2 class="font-headline text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
        Quem vai pagar?
      </h2>
      <p class="max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
        Selecione primeiro o canal de WhatsApp. Depois busque a conversa filtrada por esse canal.
      </p>
    </header>

    <div class="space-y-2">
      <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        Canal de envio
      </label>
      <select
        v-model.number="canalSelecionado"
        :class="inputClass"
        :disabled="carregandoCanais"
      >
        <option :value="0" disabled>
          {{ carregandoCanais ? 'Carregando canais...' : 'Selecione um canal' }}
        </option>
        <option v-for="canal in canais" :key="canal.id" :value="canal.id">
          {{ canal.nome || `Canal #${canal.id}` }}
        </option>
      </select>
      <p v-if="erroCanais" class="font-body text-sm text-danger dark:text-dark-danger">
        {{ erroCanais }}
      </p>
    </div>

    <div class="space-y-2">
      <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        WhatsApp do Cliente
      </label>
      <div class="flex gap-2">
        <input
          v-model="termoBusca"
          type="text"
          :placeholder="temCanalSelecionado
            ? 'Digite o nome ou telefone e pressione Enter'
            : 'Selecione o canal primeiro'"
          :class="inputClass"
          :disabled="!temCanalSelecionado || buscando"
          @keyup.enter="pesquisarConversas"
        >
        <button
          type="button"
          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-label text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-600 dark:hover:bg-primary-700"
          :disabled="!temCanalSelecionado || buscando"
          @click="pesquisarConversas"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" stroke-linecap="round" />
          </svg>
          <span class="hidden sm:inline">Buscar</span>
        </button>
      </div>

      <p
        v-if="!temCanalSelecionado"
        class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Selecione o canal de envio para liberar a busca de clientes.
      </p>
      <p v-else-if="buscando" class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Buscando conversas...
      </p>
      <p v-else-if="erroBusca" class="font-body text-sm text-danger dark:text-dark-danger">
        {{ erroBusca }}
      </p>
      <div v-else-if="semResultados" class="space-y-3">
        <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Nenhuma conversa encontrada neste canal para este termo.
        </p>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-primary/40 bg-primary-50/60 px-4 py-2.5 font-label text-sm font-semibold text-primary-700 transition hover:bg-primary-100 dark:border-dark-primary/40 dark:bg-dark-primary-container/20 dark:text-dark-primary dark:hover:bg-dark-primary-container/40"
          @click="abrirCriarConversa"
        >
          Criar nova conversa para esse canal
        </button>
      </div>

      <div
        v-if="temClienteSelecionado && !clienteVisivelNosResultados"
        class="rounded-xl border border-primary bg-primary-50/70 p-3 dark:border-dark-primary dark:bg-dark-primary-container/30"
      >
        <p class="font-label text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          {{ clienteNome || 'Sem nome' }}
        </p>
        <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ clienteTelefone || 'Sem telefone' }}
        </p>
      </div>

      <ul
        v-if="temCanalSelecionado && resultados.length > 0"
        class="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-outline/30 p-2 dark:border-dark-outline/30"
      >
        <li v-for="conversa in resultados" :key="conversa.key">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition"
            :class="conversaKey === conversa.key
              ? 'border-primary bg-primary-50/70 dark:border-dark-primary dark:bg-dark-primary-container/30'
              : 'border-transparent bg-surface-container-lowest hover:bg-surface-container-low dark:bg-dark-surface-container-low dark:hover:bg-dark-surface-container'"
            @click="selecionarConversa(conversa)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-label text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ conversa.name || 'Sem nome' }}
              </span>
              <span class="block truncate font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ conversa.phone || 'Sem telefone' }}
              </span>
            </span>
            <svg
              v-if="conversaKey === conversa.key"
              class="h-5 w-5 shrink-0 text-primary dark:text-dark-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </li>
      </ul>
    </div>

    <ModalCriaconversa
      v-if="workspaceId != null"
      v-model:open="modalCriarAberto"
      :workspace-id="workspaceId"
      :id-canal="canalSelecionado"
      :phone-inicial="termoBusca"
      @created="onConversaCriada"
    />
  </section>
</template>
