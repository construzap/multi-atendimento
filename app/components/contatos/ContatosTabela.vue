<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseAvatar from '~/components/BaseAvatar.vue'
import ContatoEditarModal from '~/components/contatos/ContatoEditarModal.vue'
import type { Contato } from '#shared/types/contato'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useContatosStore } from '~/stores/contatos'

const contatosStore = useContatosStore()
const canaisStore = useCanaisStore()

const { items, total, pending, loadingMore, error, hasMore, workspaceId } = storeToRefs(contatosStore)
const { items: canais } = storeToRefs(canaisStore)

const modalEditarAberto = ref(false)
const contatoEmEdicao = ref<Contato | null>(null)

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function fmtBool(val: boolean | null | undefined): string {
  if (val === null || val === undefined) return '—'
  return val ? 'Sim' : 'Não'
}

function fmtConversaAberta(val: boolean | null | undefined): string {
  if (val === null || val === undefined) return 'Aberta'
  return val ? 'Aberta' : 'Fechada'
}

const rows = computed(() => items.value ?? [])

const canaisPorId = computed(() => {
  const map = new Map<number, string>()
  for (const canal of canais.value) {
    const nome = canal.nome?.trim()
    map.set(canal.id, nome || `Canal #${canal.id}`)
  }
  return map
})

function nomeCanal(idCanal: number | null | undefined): string {
  if (idCanal == null) return '—'
  return canaisPorId.value.get(idCanal) ?? `Canal #${idCanal}`
}

function textoGrupo(isGroup: boolean | null | undefined, nameGroup: string | null | undefined): string {
  if (isGroup === true) {
    const nome = nameGroup?.trim()
    return nome ? `Sim · ${nome}` : 'Sim'
  }
  if (isGroup === false) return 'Não'
  return '—'
}

function textoColunaFunil(contato: Contato): string {
  const sf = contato.status_funil
  if (!sf) return '—'
  const nome = sf.coluna_nome?.trim()
  if (nome) return nome
  if (sf.coluna_id != null && sf.coluna_id > 0) return `Coluna #${sf.coluna_id}`
  return '—'
}

async function garantirCanais() {
  const wid = workspaceId.value
  if (wid == null) return
  try {
    await canaisStore.fetchCanais(wid)
  } catch {
    // Lista de contatos segue sem nome do canal; erro já fica em canaisStore.listError.
  }
}

async function carregarMais() {
  const wid = workspaceId.value
  if (wid == null) return

  try {
    await contatosStore.fetchPagina(wid, {
      append: true,
      q: contatosStore.emModoBusca ? contatosStore.busca.q : undefined,
    })
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar mais contatos.'), { duration: 8000 })
  }
}

function abrirEditar(contato: Contato) {
  contatoEmEdicao.value = contato
  modalEditarAberto.value = true
}

onMounted(() => {
  void garantirCanais()
})

watch(workspaceId, (wid) => {
  if (wid != null) void garantirCanais()
})
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low">
    <div class="border-b border-outline/30 px-5 py-4 dark:border-dark-outline/30">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">Contatos</h2>
          <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ total }} registro(s)
          </p>
        </div>
        <div v-if="pending" class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Carregando…
        </div>
      </div>
    </div>

    <div v-if="error" class="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200">
      {{ error }}
    </div>

    <div
      v-else-if="pending && rows.length === 0"
      class="m-5 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      Carregando contatos…
    </div>

    <div v-else-if="!pending && rows.length === 0" class="m-5 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      Nenhum contato encontrado.
    </div>

    <template v-else>
      <div class="w-full overflow-x-auto">
      <table class="w-full min-w-[64rem] border-separate border-spacing-0">
        <thead>
          <tr class="text-left text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Foto</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Nome</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Telefone</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Conversa aberta</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Grupo</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">I.A.</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Canal</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Coluna do funil</th>
            <th class="sticky top-0 z-[1] w-16 bg-surface-container-lowest px-3 py-3 text-right dark:bg-dark-surface-container-low">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in rows"
            :key="c.key"
            class="border-t border-outline/20 text-sm text-on-surface hover:bg-surface-container-low dark:border-dark-outline/20 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
          >
            <td class="px-5 py-4">
              <BaseAvatar
                :src="c.photo ?? null"
                :alt="firstNonEmpty(c.name, c.phone, 'Contato')"
                :text="(firstNonEmpty(c.name, c.phone, '?')[0] ?? '?').toUpperCase()"
                :size="36"
                variant="circle"
              />
            </td>
            <td class="px-5 py-4">
              <div class="max-w-[14rem] truncate font-semibold">
                {{ firstNonEmpty(c.name, c.phone, '—') }}
              </div>
            </td>
            <td class="px-5 py-4 font-mono text-xs">{{ c.phone ?? '—' }}</td>
            <td class="px-5 py-4 text-xs">{{ fmtConversaAberta(c.conversa_aberta) }}</td>
            <td class="px-5 py-4 text-xs">{{ textoGrupo(c.is_group, c.name_group) }}</td>
            <td class="px-5 py-4 text-xs">{{ fmtBool(c.ia_ligada) }}</td>
            <td class="px-5 py-4 text-xs">
              <span class="font-medium">{{ nomeCanal(c.id_canal) }}</span>
              <span
                v-if="c.id_canal != null"
                class="mt-0.5 block font-mono text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant"
              >
                #{{ c.id_canal }}
              </span>
            </td>
            <td class="px-5 py-4 text-xs">
              <span
                v-if="c.status_funil"
                class="inline-flex max-w-[12rem] items-center gap-1.5"
              >
                <span
                  v-if="c.status_funil.coluna_cor"
                  class="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-outline/20 dark:ring-dark-outline/30"
                  :style="{ backgroundColor: c.status_funil.coluna_cor }"
                  aria-hidden="true"
                />
                <span class="truncate font-medium">{{ textoColunaFunil(c) }}</span>
              </span>
              <span v-else>—</span>
            </td>
            <td class="px-3 py-4 text-right">
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
                title="Editar contato"
                aria-label="Editar contato"
                @click="abrirEditar(c)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                  <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <div v-if="hasMore" class="border-t border-outline/30 px-5 py-4 dark:border-dark-outline/30">
        <button
          type="button"
          class="w-full rounded-xl border border-outline/30 bg-white/80 px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/30 dark:bg-dark-surface-container-low/60 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
          :disabled="loadingMore || pending"
          @click="carregarMais"
        >
          <span v-if="loadingMore" class="inline-flex items-center justify-center gap-2">
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-hidden="true"
            />
            Carregando…
          </span>
          <span v-else>Carregar mais</span>
        </button>
      </div>
    </template>

    <ContatoEditarModal
      v-model:open="modalEditarAberto"
      :workspace-id="workspaceId"
      :contato="contatoEmEdicao"
    />
  </div>
</template>
