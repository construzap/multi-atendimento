<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import ProdutosSelecaoUnica from '~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue'
import type { ItemSelecaoUnica } from '~/components/produtos/selecao-unica/produtosSelecaoUnicaConfig'
import type { ProdutoOportunidadeVendaItem, ProdutoWorkspacePatch } from '#shared/types/produtos'
import { mensagemErroFetch } from '~/stores/canais'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { useProdutosStore } from '~/stores/produtos'
import { useWorkspacesStore } from '~/stores/workspaces'
import { abrirConversaNoChat } from '~/composables/useConversasRouteSync'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const props = defineProps<{
  workspaceId: number | null
}>()

const open = defineModel<boolean>('open', { default: false })
const ocupadoModel = defineModel<boolean>('ocupado', { default: false })

const emit = defineEmits<{
  /** Emitido ao fechar o modal se houve cadastro(s) — pai refresca lista/total e workspace. */
  sincronizar: []
}>()

const config = useRuntimeConfig()
const produtosStore = useProdutosStore()
const workspacesStore = useWorkspacesStore()
const termosStore = useProdutoTermosPesquisaStore()
const {
  oportunidadesVendas,
  oportunidadesVendasListPending,
  oportunidadesVendasTemMais,
} = storeToRefs(produtosStore)

/** True se cadastrou pelo menos um produto nesta abertura do modal. */
const cadastrouNestaAbertura = ref(false)
const itemEmCadastroChave = ref<string | null>(null)
const nomeDraft = ref('')
const precoVistaDraft = ref('')
/** Termo de pesquisa (`ProdutosSelecaoUnica` / catalogo termos) — id → `termo_pesquisa`. */
const termoSelecao = ref<ItemSelecaoUnica | null>(null)
const cadastrando = ref(false)
const limiteAtingidoAberto = ref(false)
const limiteAtingidoMensagem = ref('')

const itemParaExcluir = ref<ProdutoOportunidadeVendaItem | null>(null)
const alertaExcluirAberto = ref(false)
const progressoExcluirAberto = ref(false)
const progressoExcluirTotal = ref(0)
const progressoExcluirEnviados = ref(0)
const progressoExcluirErro = ref<string | null>(null)
const excluindo = ref(false)

const whatsappComercialNumero = computed(() => {
  const raw = String(config.public.whatsappComercialNumero ?? '').replace(/\D/g, '')
  return raw.length ? raw : null
})

const whatsappLimiteUrl = computed(() => {
  const n = whatsappComercialNumero.value
  if (!n) return null
  const texto = encodeURIComponent(
    'Olá! Preciso aumentar o limite de produtos do meu workspace na I.A.',
  )
  return `https://wa.me/${n}?text=${texto}`
})

watch(
  [alertaExcluirAberto, progressoExcluirAberto, excluindo],
  () => {
    ocupadoModel.value =
      alertaExcluirAberto.value || progressoExcluirAberto.value || excluindo.value
  },
  { immediate: true },
)

function chaveItem(item: ProdutoOportunidadeVendaItem) {
  return `${item.workspace_id}:${item.canal_id ?? 'x'}:${item.produto_chave}`
}

function isEmCadastro(item: ProdutoOportunidadeVendaItem) {
  return itemEmCadastroChave.value === chaveItem(item)
}

type ClienteOcorrenciaResumo = {
  chave: string
  contato_nome: string | null
  phone: string | null
  conversa_key: string | null
  buscas: number
}

/** Agrupa `ocorrencias` por telefone (ou nome) e conta quantas vezes cada cliente buscou. */
function clientesDasOcorrencias(item: ProdutoOportunidadeVendaItem): ClienteOcorrenciaResumo[] {
  const map = new Map<string, ClienteOcorrenciaResumo>()
  for (const o of item.ocorrencias ?? []) {
    const phone = o.phone?.trim() || null
    const nome = o.contato_nome?.trim() || null
    const conversa_key = o.conversa_key?.trim() || null
    const chave = phone || nome || `id:${o.id}`
    const atual = map.get(chave)
    if (atual) {
      atual.buscas += 1
      if (!atual.contato_nome && nome) atual.contato_nome = nome
      if (!atual.phone && phone) atual.phone = phone
      if (!atual.conversa_key && conversa_key) atual.conversa_key = conversa_key
    } else {
      map.set(chave, { chave, contato_nome: nome, phone, conversa_key, buscas: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.buscas - a.buscas || (a.contato_nome ?? a.phone ?? '').localeCompare(b.contato_nome ?? b.phone ?? '', 'pt'))
}

function rotuloCliente(c: ClienteOcorrenciaResumo) {
  const nome = c.contato_nome?.trim()
  const phone = c.phone?.trim()
  if (nome && phone) return `${nome} · ${phone}`
  if (nome) return nome
  if (phone) return phone
  return 'Cliente'
}

function workspaceIdParaChat(): number | null {
  const fromProp = props.workspaceId
  if (fromProp != null && Number.isFinite(fromProp) && fromProp >= 1) return Math.trunc(fromProp)
  const raw = workspacesStore.currentWorkspaceId
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null
}

function podeAbrirConversa(item: ProdutoOportunidadeVendaItem, cliente: ClienteOcorrenciaResumo) {
  const wid = workspaceIdParaChat()
  const canalId = item.canal_id
  const key = cliente.conversa_key?.trim()
  return wid != null && canalId != null && canalId >= 1 && !!key
}

async function irParaConversa(item: ProdutoOportunidadeVendaItem, cliente: ClienteOcorrenciaResumo) {
  const wid = workspaceIdParaChat()
  const canalId = item.canal_id
  const key = cliente.conversa_key?.trim()
  if (wid == null || canalId == null || canalId < 1 || !key) {
    toast.error('Conversa indisponível para este cliente.')
    return
  }
  try {
    await abrirConversaNoChat(wid, canalId, key)
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível abrir a conversa.'))
  }
}

watch(
  () => props.workspaceId,
  (wid) => {
    if (wid == null || wid < 1) {
      open.value = false
      cancelarCadastroInline()
    }
  },
)

watch(open, async (aberto) => {
  if (aberto) {
    cadastrouNestaAbertura.value = false
    cancelarCadastroInline()
    try {
      await produtosStore.fetchOportunidadesVendasPagina({ reset: true })
    } catch (err) {
      toast.error(mensagemErroFetch(err, 'Não foi possível carregar as sugestões.'))
    }
    return
  }
  cancelarCadastroInline()
  limiteAtingidoAberto.value = false
  if (cadastrouNestaAbertura.value) {
    cadastrouNestaAbertura.value = false
    emit('sincronizar')
  }
})

function cancelarCadastroInline() {
  itemEmCadastroChave.value = null
  nomeDraft.value = ''
  precoVistaDraft.value = ''
  termoSelecao.value = null
  cadastrando.value = false
}

/** Mesmo contrato da tabela (`@commit` com `termos_pesquisa_ids`). */
function aoCommitTermo(patch: ProdutoWorkspacePatch) {
  const ids = patch.termos_pesquisa_ids ?? []
  const id = ids[0]
  if (id == null || !Number.isFinite(id) || id < 1) {
    termoSelecao.value = null
    return
  }
  const tid = Math.trunc(id)
  const wid = props.workspaceId
  const nome =
    (wid != null && wid >= 1
      ? termosStore.getListaCompletaCopia(wid).find((t) => t.id === tid)?.nome
      : null) ??
    (termoSelecao.value?.id === tid ? termoSelecao.value.nome : null) ??
    ''
  termoSelecao.value = nome ? { id: tid, nome } : { id: tid, nome: String(tid) }
}

async function carregarMais() {
  if (!oportunidadesVendasTemMais.value || oportunidadesVendasListPending.value) return
  try {
    await produtosStore.fetchOportunidadesVendasPagina({ reset: false })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar mais sugestões.'))
  }
}

function iniciarCadastro(item: ProdutoOportunidadeVendaItem) {
  itemEmCadastroChave.value = chaveItem(item)
  nomeDraft.value = String(item.produto_sugerido ?? '').trim()
  precoVistaDraft.value = ''
  termoSelecao.value = null
  limiteAtingidoAberto.value = false
}

function isErroLimiteProdutos(err: unknown): boolean {
  const msg = mensagemErroFetch(err, '').toLowerCase()
  if (msg.includes('limite de produtos') || msg.includes('só é possível adicionar mais')) return true
  const e = err as { statusCode?: number; data?: { statusCode?: number; statusMessage?: string } }
  const code = e?.statusCode ?? e?.data?.statusCode
  const statusMsg = String(e?.data?.statusMessage ?? '').toLowerCase()
  return code === 403 && (statusMsg.includes('limite') || msg.includes('limite'))
}

function idsOcorrencias(item: ProdutoOportunidadeVendaItem): number[] {
  return [
    ...new Set(
      (item.ocorrencias ?? [])
        .map((o) => o.id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
    ),
  ]
}

const textoAlertaExcluir = computed(() => {
  const item = itemParaExcluir.value
  if (!item) return ''
  const n = idsOcorrencias(item).length || item.ocorrencias?.length || item.total_buscas || 1
  const nome = item.produto_sugerido?.trim() || 'esta sugestão'
  return `Apagar «${nome}» e as ${n} ocorrência${n === 1 ? '' : 's'} associada${n === 1 ? '' : 's'}? Esta ação não pode ser desfeita.`
})

function pedirExcluir(item: ProdutoOportunidadeVendaItem) {
  if (cadastrando.value || excluindo.value) return
  const n = idsOcorrencias(item).length
  if (n < 1) {
    toast.error('Esta sugestão não tem ocorrências para apagar.')
    return
  }
  itemParaExcluir.value = item
  alertaExcluirAberto.value = true
}

function cancelarAlertaExcluir() {
  if (excluindo.value) return
  alertaExcluirAberto.value = false
  itemParaExcluir.value = null
}

async function confirmarExcluir() {
  const item = itemParaExcluir.value
  const wid = props.workspaceId
  if (!item || wid == null || wid < 1 || excluindo.value) return

  const total = idsOcorrencias(item).length
  alertaExcluirAberto.value = false
  progressoExcluirErro.value = null
  progressoExcluirTotal.value = total
  progressoExcluirEnviados.value = 0
  progressoExcluirAberto.value = true
  excluindo.value = true

  if (isEmCadastro(item)) cancelarCadastroInline()

  try {
    await produtosStore.excluirOportunidadeVenda({
      workspaceId: wid,
      item,
      onProgress: (enviados, tot) => {
        progressoExcluirEnviados.value = enviados
        progressoExcluirTotal.value = tot
      },
    })
    progressoExcluirEnviados.value = total
    toast.success(
      total === 1
        ? 'Ocorrência apagada.'
        : `${total} ocorrências apagadas.`,
    )
    itemParaExcluir.value = null
    sincronizarModalComListaSugestoes()
    window.setTimeout(() => {
      progressoExcluirAberto.value = false
    }, 400)
  } catch (err) {
    progressoExcluirErro.value = mensagemErroFetch(err, 'Não foi possível apagar as ocorrências.')
  } finally {
    excluindo.value = false
  }
}

function fecharProgressoExcluir() {
  if (excluindo.value) return
  progressoExcluirAberto.value = false
  progressoExcluirErro.value = null
  itemParaExcluir.value = null
}

/** Se não restar sugestão no Pinia, fecha o modal; senão mantém aberto. */
function sincronizarModalComListaSugestoes() {
  if (oportunidadesVendas.value.length === 0) {
    open.value = false
  }
}

async function confirmarCadastro(item: ProdutoOportunidadeVendaItem) {
  const wid = props.workspaceId
  if (wid == null || wid < 1 || cadastrando.value) return

  const nome = nomeDraft.value.trim()
  if (!nome) {
    toast.error('Informe o nome do produto.')
    return
  }

  const precoRaw = precoVistaDraft.value.trim()
  let preco = 0
  if (precoRaw.length) {
    const n = parseDecimalPtBr(precoRaw)
    if (n == null || n < 0) {
      toast.error('Informe um preço à vista válido.')
      return
    }
    preco = n
  }

  cadastrando.value = true
  limiteAtingidoAberto.value = false
  try {
    await produtosStore.cadastrarProdutoDeOportunidade({
      workspaceId: wid,
      item,
      nome,
      preco,
      termoPesquisaId: termoSelecao.value?.id ?? null,
    })
    cadastrouNestaAbertura.value = true
    cancelarCadastroInline()
    toast.success(`Produto «${nome}» cadastrado.`)
    sincronizarModalComListaSugestoes()
  } catch (err) {
    if (isErroLimiteProdutos(err)) {
      limiteAtingidoMensagem.value =
        mensagemErroFetch(err, 'Limite de produtos atingido. É necessário aumentar o limite.')
      limiteAtingidoAberto.value = true
    } else {
      toast.error(mensagemErroFetch(err, 'Não foi possível cadastrar o produto.'))
    }
  } finally {
    cadastrando.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Sugestões de produtos"
    panel-class="w-full max-w-xl"
    body-class="max-h-[min(28rem,60vh)] overflow-y-auto"
  >
    <template #subtitle>
      Produtos buscados por clientes e ainda não cadastrados no catálogo.
    </template>

    <template #icon>
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">trending_up</span>
    </template>

    <div
      v-if="limiteAtingidoAberto"
      class="mb-4 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/40"
    >
      <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">
        Limite de produtos atingido
      </p>
      <p class="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
        {{ limiteAtingidoMensagem || 'É necessário aumentar o limite de produtos do workspace.' }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <a
          v-if="whatsappLimiteUrl"
          :href="whatsappLimiteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
          Falar no WhatsApp
        </a>
        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          :block="false"
          @click="limiteAtingidoAberto = false"
        >
          Fechar
        </BaseButton>
      </div>
    </div>

    <div
      v-if="oportunidadesVendasListPending && !oportunidadesVendas.length"
      class="py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      A carregar sugestões…
    </div>

    <template v-else>
      <ul class="space-y-3">
        <li
          v-for="item in oportunidadesVendas"
          :key="chaveItem(item)"
          class="rounded-xl border border-outline/30 bg-surface-container-lowest p-3 dark:border-dark-outline/35 dark:bg-dark-surface-container-lowest"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 space-y-1.5">
              <p
                v-if="!isEmCadastro(item)"
                class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface"
              >
                {{ item.produto_sugerido }}
              </p>
              <span
                class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                Buscado {{ item.total_buscas }}x por {{ item.clientes_unicos }}
                {{ item.clientes_unicos === 1 ? 'cliente' : 'clientes' }}
              </span>
              <ul
                v-if="clientesDasOcorrencias(item).length"
                class="space-y-1 pt-0.5"
              >
                <li
                  v-for="cliente in clientesDasOcorrencias(item)"
                  :key="cliente.chave"
                  class="flex min-w-0 items-center gap-1.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  <span class="material-symbols-outlined shrink-0 text-[14px] text-emerald-600/80 dark:text-emerald-400/80" aria-hidden="true">
                    person
                  </span>
                  <span class="min-w-0 flex-1 truncate">
                    {{ rotuloCliente(cliente) }}
                  </span>
                  <span class="shrink-0 font-medium text-on-surface/80 dark:text-dark-on-surface/80">
                    · {{ cliente.buscas }}x
                  </span>
                  <button
                    v-if="podeAbrirConversa(item, cliente)"
                    type="button"
                    class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-200/80 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                    title="Abrir conversa"
                    aria-label="Abrir conversa"
                    :disabled="cadastrando || excluindo"
                    @click.stop="void irParaConversa(item, cliente)"
                  >
                    <span class="material-symbols-outlined text-[14px]" aria-hidden="true">chat</span>
                  </button>
                </li>
              </ul>
            </div>

            <div
              v-if="!isEmCadastro(item)"
              class="flex shrink-0 flex-wrap items-center justify-end gap-2"
            >
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
                :disabled="cadastrando || excluindo"
                title="Apagar sugestão"
                aria-label="Apagar sugestão"
                @click="pedirExcluir(item)"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
              </button>
              <BaseButton
                type="button"
                variant="primary"
                size="sm"
                :block="false"
                :disabled="cadastrando || excluindo"
                @click="iniciarCadastro(item)"
              >
                <span class="inline-flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                  Cadastrar
                </span>
              </BaseButton>
            </div>
          </div>

          <div
            v-if="isEmCadastro(item)"
            class="mt-3 space-y-3 border-t border-outline/20 pt-3 dark:border-dark-outline/25"
          >
            <div>
              <label class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                Nome do produto
              </label>
              <input
                v-model="nomeDraft"
                type="text"
                autocomplete="off"
                placeholder="Nome do produto"
                class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline/50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
                :disabled="cadastrando"
                @keydown.enter.prevent="confirmarCadastro(item)"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                Preço à vista
              </label>
              <input
                v-model="precoVistaDraft"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                placeholder="0,00"
                class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline/50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface"
                :disabled="cadastrando"
                @keydown.enter.prevent="confirmarCadastro(item)"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
                Categoria / Termo de pesquisa
              </label>
              <ProdutosSelecaoUnica
                catalogo="termos_pesquisa"
                variant="celula"
                :workspace-id="workspaceId"
                :termo-id="termoSelecao?.id ?? null"
                :termo-nome="termoSelecao?.nome ?? null"
                :disabled="cadastrando"
                @commit="aoCommitTermo"
              />
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <BaseButton
                type="button"
                variant="secondary"
                size="sm"
                :block="false"
                :disabled="cadastrando"
                @click="cancelarCadastroInline"
              >
                Cancelar
              </BaseButton>
              <BaseButton
                type="button"
                variant="primary"
                size="sm"
                :block="false"
                :disabled="cadastrando"
                @click="confirmarCadastro(item)"
              >
                <span class="inline-flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                  {{ cadastrando ? 'A cadastrar…' : 'Cadastrar' }}
                </span>
              </BaseButton>
            </div>
          </div>
        </li>
      </ul>

      <div v-if="oportunidadesVendasTemMais" class="mt-4 flex justify-center">
        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          :block="false"
          :disabled="oportunidadesVendasListPending || cadastrando || excluindo"
          @click="carregarMais"
        >
          {{ oportunidadesVendasListPending ? 'A carregar…' : 'Carregar mais' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>

  <ModalAlerta
    v-model:open="alertaExcluirAberto"
    title="Apagar sugestão"
    :texto="textoAlertaExcluir"
    variante="perigo"
    texto-confirmar="Apagar"
    texto-cancelar="Cancelar"
    :confirmar-desabilitado="excluindo"
    :cancelar-desabilitado="excluindo"
    @confirmar="void confirmarExcluir()"
    @cancelar="cancelarAlertaExcluir"
  />

  <ModalEnvioProdutos
    v-model:open="progressoExcluirAberto"
    title="A apagar ocorrências…"
    :total="progressoExcluirTotal"
    :enviados="progressoExcluirEnviados"
    :erro="progressoExcluirErro"
    :pode-cancelar="!excluindo && !!progressoExcluirErro"
    @cancelar="fecharProgressoExcluir"
  />
</template>
