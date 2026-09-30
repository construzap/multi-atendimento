<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import type {
  AdminBuscarImagensBraveResponse,
  AdminImagemBraveItem,
} from '#shared/types/admin'
import type {
  ProdutoImagemItem,
  ProdutoSelecionadoRef,
  ProdutosFotosUploadResponse,
} from '#shared/types/produtos'
import { mensagemErroFetch } from '~/stores/canais'
import { useProdutosStore } from '~/stores/produtos'
import { useWorkspacesStore } from '~/stores/workspaces'

const open = defineModel<boolean>('open', { default: false })

const produtosStore = useProdutosStore()
const workspacesStore = useWorkspacesStore()
const { items } = storeToRefs(produtosStore)
const { currentWorkspaceId } = storeToRefs(workspacesStore)

type LinhaProduto = {
  produtoId: number
  nome: string
  parentId: number | null
  tipo: 'pai' | 'variacao'
  temImagem: boolean
  imagens: ProdutoImagemItem[]
}

const IMAGENS_POR_BUSCA = 200

const ativoId = ref<number | null>(null)
const queryEdit = ref('')
const resultados = ref<AdminImagemBraveItem[]>([])
const imagemExpandida = ref<AdminImagemBraveItem | null>(null)
/** Produto escolhido por URL de imagem. Sem entrada, usa o produto selecionado à esquerda. */
const destinoPorLink = ref<Record<string, number>>({})
const buscando = ref(false)
const aplicandoLink = ref<string | null>(null)
const dropAlvoId = ref<number | null>(null)
const bulkRodando = ref(false)
const bulkParar = ref(false)
const bulkFeitos = ref(0)
const bulkTotal = ref(0)
const bulkErro = ref<string | null>(null)

const workspaceId = computed((): number | null => {
  const raw = currentWorkspaceId.value
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

function imagemUrlVazia(imagemUrl: string | null | undefined): boolean {
  return !String(imagemUrl ?? '').trim()
}

/** Produtos da lista atual no Pinia (`items`) sem imagem. */
const linhas = computed((): LinhaProduto[] =>
  items.value
    .filter((pai) => imagemUrlVazia(pai.imagem_url) && (pai.imagens?.length ?? 0) === 0)
    .map((pai) => ({
      produtoId: pai.id,
      nome: pai.nome.trim() || `Produto #${pai.id}`,
      parentId: null,
      tipo: 'pai' as const,
      temImagem: false,
      imagens: [...(pai.imagens ?? [])],
    })),
)

const temAlvoBulk = computed(() => linhas.value.length > 0)

const linhaAtiva = computed(() =>
  linhas.value.find((l) => l.produtoId === ativoId.value) ?? null,
)

function fechar() {
  if (bulkRodando.value) {
    bulkParar.value = true
    return
  }
  open.value = false
}

function montarRef(linha: LinhaProduto): ProdutoSelecionadoRef {
  return {
    produtoId: linha.produtoId,
    nome: linha.nome,
    contexto: 'lista',
    parentId: linha.parentId,
    tipo: linha.tipo,
  }
}

function selecionarLinha(linha: LinhaProduto) {
  if (bulkRodando.value) return
  ativoId.value = linha.produtoId
  queryEdit.value = linha.nome
}

function destinoIdDaImagem(link: string): number | null {
  const escolhido = destinoPorLink.value[link]
  if (escolhido != null && linhas.value.some((l) => l.produtoId === escolhido)) {
    return escolhido
  }
  return ativoId.value
}

function definirDestino(link: string, raw: string) {
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id)) return
  destinoPorLink.value = { ...destinoPorLink.value, [link]: id }
}

function expandirImagem(img: AdminImagemBraveItem) {
  imagemExpandida.value = img
}

function fecharImagemExpandida() {
  imagemExpandida.value = null
}

function iniciarArrasteImagem(event: DragEvent, img: AdminImagemBraveItem) {
  if (!event.dataTransfer || bulkRodando.value || aplicandoLink.value) return
  event.dataTransfer.setData('application/x-brave-imagem', img.link)
  event.dataTransfer.setData('text/plain', img.link)
  event.dataTransfer.effectAllowed = 'copy'
}

function aoArrastarSobreProduto(event: DragEvent, produtoId: number) {
  if (bulkRodando.value || aplicandoLink.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  dropAlvoId.value = produtoId
}

function aoSairDoProduto(produtoId: number) {
  if (dropAlvoId.value === produtoId) dropAlvoId.value = null
}

async function buscarImagens(qOverride?: string) {
  const q = String(qOverride ?? queryEdit.value ?? '').trim()
  if (!q) {
    toast.error('Informe o nome para buscar.')
    return
  }
  buscando.value = true
  destinoPorLink.value = {}
  imagemExpandida.value = null
  try {
    const res = await $fetch<AdminBuscarImagensBraveResponse>(
      '/api/admin/produtos/imagens-brave/buscar',
      { method: 'POST', body: { q, num: IMAGENS_POR_BUSCA } },
    )
    resultados.value = res.items ?? []
    if (!resultados.value.length) {
      toast.message('Nenhuma imagem encontrada para este termo.')
    }
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Falha ao buscar imagens na Brave.'))
    resultados.value = []
  } finally {
    buscando.value = false
  }
}

async function aplicarImagemNaLinha(linha: LinhaProduto, url: string): Promise<boolean> {
  const wid = workspaceId.value
  if (wid == null) {
    toast.error('Workspace inválido.')
    return false
  }
  const origem = url.trim()
  if (!origem) return false

  aplicandoLink.value = origem
  try {
    const baixada = await $fetch<{ mime: string; data_base64: string }>(
      '/api/admin/produtos/imagens-brave/baixar',
      { method: 'POST', body: { url: origem } },
    )
    const ordem = linha.imagens.length
    const res = await $fetch<ProdutosFotosUploadResponse>(
      '/api/produtos/fotosblackblaze/upload',
      {
        method: 'POST',
        body: {
          workspace_id: wid,
          produto_id: linha.produtoId,
          itens: [
            {
              mime: baixada.mime,
              data_base64: baixada.data_base64,
              ordem,
              filename: 'brave.jpg',
            },
          ],
        },
      },
    )
    const inserida = res.data?.[0]
    if (!inserida) {
      throw new Error('Não foi possível enviar a imagem.')
    }
    const imagens = [...linha.imagens, { ...inserida, ordem, produto_id: linha.produtoId }]
    const capa = produtosStore.urlImagemPrincipal(imagens) || String(inserida.imagem_url ?? inserida.url ?? '')
    produtosStore.aplicarEmProdutoSelecionado(montarRef(linha), {
      imagens,
      imagem_url: capa,
    })
    return true
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Falha ao enviar a imagem para o produto.'))
    return false
  } finally {
    aplicandoLink.value = null
  }
}

async function soltarImagemNoProduto(event: DragEvent, linha: LinhaProduto) {
  event.preventDefault()
  dropAlvoId.value = null
  if (bulkRodando.value || aplicandoLink.value) return
  const link =
    event.dataTransfer?.getData('application/x-brave-imagem') ||
    event.dataTransfer?.getData('text/plain') ||
    ''
  const img = resultados.value.find((item) => item.link === link.trim())
  if (!img) return
  const ok = await aplicarImagemNaLinha(linha, img.link)
  if (ok) toast.success(`Imagem enviada para «${linha.nome}».`)
}

async function aplicarResultado(item: AdminImagemBraveItem) {
  if (bulkRodando.value) return
  const destinoId = destinoIdDaImagem(item.link)
  const linha = linhas.value.find((l) => l.produtoId === destinoId) ?? null
  if (!linha) {
    toast.error('Escolha o produto que vai receber esta imagem.')
    return
  }
  const ok = await aplicarImagemNaLinha(linha, item.link)
  if (ok) {
    toast.success(`Imagem enviada para «${linha.nome}».`)
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function aplicarPrimeiraEmMassa() {
  const alvos = linhas.value
  if (!alvos.length) {
    toast.message('Não há produtos sem imagem nesta página.')
    return
  }
  if (bulkRodando.value) return

  bulkRodando.value = true
  bulkParar.value = false
  bulkFeitos.value = 0
  bulkTotal.value = alvos.length
  bulkErro.value = null

  let okCount = 0
  let failCount = 0

  try {
    for (const linha of alvos) {
      if (bulkParar.value) break

      // Re-lê estado atual (pode ter ganhado imagem no meio do loop)
      const atual = linhas.value.find((l) => l.produtoId === linha.produtoId)
      if (!atual || atual.temImagem) {
        bulkFeitos.value += 1
        continue
      }

      ativoId.value = atual.produtoId
      queryEdit.value = atual.nome
      resultados.value = []

      try {
        const res = await $fetch<AdminBuscarImagensBraveResponse>(
          '/api/admin/produtos/imagens-brave/buscar',
          { method: 'POST', body: { q: atual.nome, num: 4 } },
        )
        resultados.value = res.items ?? []
        const primeira = resultados.value[0]
        if (!primeira) {
          failCount += 1
        } else {
          const ok = await aplicarImagemNaLinha(atual, primeira.link)
          if (ok) okCount += 1
          else failCount += 1
        }
      } catch (err) {
        failCount += 1
        bulkErro.value = mensagemErroFetch(err, 'Erro no lote.')
        // Quota / auth: interrompe para não gastar mais
        const msg = bulkErro.value.toLowerCase()
        if (msg.includes('quota') || msg.includes('429') || msg.includes('não configurado')) {
          break
        }
      }

      bulkFeitos.value += 1
      await sleep(350)
    }
  } finally {
    bulkRodando.value = false
  }

  if (bulkParar.value) {
    toast.message(`Lote interrompido: ${okCount} ok, ${failCount} falhas.`)
  } else {
    toast.success(`Lote concluído: ${okCount} imagens aplicadas, ${failCount} falhas.`)
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    bulkParar.value = true
    ativoId.value = null
    queryEdit.value = ''
    resultados.value = []
    destinoPorLink.value = {}
    imagemExpandida.value = null
    bulkErro.value = null
    return
  }
  const primeira = linhas.value[0]
  if (primeira) selecionarLinha(primeira)
})

watch(imagemExpandida, (img, _anterior, onCleanup) => {
  if (!img || !import.meta.client) return
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    fecharImagemExpandida()
  }
  document.addEventListener('keydown', onKey, true)
  onCleanup(() => document.removeEventListener('keydown', onKey, true))
})
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Criar imagens"
    panel-class="w-full max-w-4xl max-h-[90vh]"
    body-class="flex min-h-0 flex-col gap-4"
    :show-close="!bulkRodando"
    :close-on-backdrop="!bulkRodando"
    :close-on-escape="!bulkRodando && !imagemExpandida"
    @close="fechar"
  >
    <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Busca até 200 imagens na Brave. Arraste a foto para o nome do produto
      para baixar, enviar ao Blackblaze e gravar no produto.
    </p>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-on-surface dark:text-dark-on-surface">
        Sem imagem ({{ linhas.length }})
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <BaseButton
          v-if="!bulkRodando"
          variant="secondary"
          :block="false"
          size="sm"
          type="button"
          :disabled="!temAlvoBulk"
          @click="aplicarPrimeiraEmMassa"
        >
          Aplicar 1ª imagem em massa
        </BaseButton>
        <BaseButton
          v-else
          variant="danger"
          :block="false"
          size="sm"
          type="button"
          @click="bulkParar = true"
        >
          Parar lote ({{ bulkFeitos }}/{{ bulkTotal }})
        </BaseButton>
      </div>
    </div>

    <p
      v-if="bulkErro"
      class="rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-100"
    >
      {{ bulkErro }}
    </p>

    <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div
        class="max-h-[42vh] overflow-y-auto rounded-xl border border-outline/30 dark:border-dark-outline/30 lg:max-h-[55vh]"
      >
        <ul class="divide-y divide-outline/20 dark:divide-dark-outline/20">
          <li v-if="!linhas.length" class="px-3 py-6 text-center text-sm text-on-surface-variant">
            Nenhum produto sem imagem nesta lista.
          </li>
          <li v-for="linha in linhas" :key="linha.produtoId">
            <button
              type="button"
              class="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high"
              :class="[
                ativoId === linha.produtoId
                  ? 'bg-primary-600/10 text-on-surface dark:bg-primary-600/20 dark:text-dark-on-surface'
                  : 'text-on-surface dark:text-dark-on-surface',
                dropAlvoId === linha.produtoId
                  ? 'ring-2 ring-inset ring-primary-600'
                  : '',
              ]"
              :disabled="bulkRodando"
              @click="selecionarLinha(linha)"
              @dragover="aoArrastarSobreProduto($event, linha.produtoId)"
              @dragleave="aoSairDoProduto(linha.produtoId)"
              @drop="soltarImagemNoProduto($event, linha)"
            >
              <span
                class="material-symbols-outlined mt-0.5 shrink-0 text-[18px]"
                :class="linha.temImagem ? 'text-success' : 'text-on-surface-variant/60'"
                aria-hidden="true"
              >
                {{ linha.temImagem ? 'check_circle' : 'image_not_supported' }}
              </span>
              <span class="min-w-0">
                <span class="line-clamp-2 font-medium leading-snug">{{ linha.nome }}</span>
                <span
                  v-if="linha.tipo === 'variacao'"
                  class="mt-0.5 block text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  variação
                </span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div class="flex min-h-0 flex-col gap-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label class="min-w-0 flex-1 text-sm">
            <span class="mb-1 block text-on-surface-variant dark:text-dark-on-surface-variant">
              Termo de busca
            </span>
            <input
              v-model="queryEdit"
              type="text"
              class="w-full rounded-xl border border-outline/40 bg-surface px-3 py-2.5 text-on-surface outline-none ring-primary-600/30 focus:ring-2 dark:border-dark-outline/40 dark:bg-dark-surface dark:text-dark-on-surface"
              :disabled="!linhaAtiva || bulkRodando || buscando"
              @keydown.enter.prevent="buscarImagens()"
            >
          </label>
          <BaseButton
            variant="primary"
            :block="false"
            size="sm"
            type="button"
            :disabled="!linhaAtiva || bulkRodando || buscando || !queryEdit.trim()"
            @click="buscarImagens()"
          >
            {{ buscando ? 'Buscando…' : 'Buscar na Brave' }}
          </BaseButton>
        </div>

        <div
          class="min-h-[12rem] flex-1 overflow-y-auto rounded-xl border border-dashed border-outline/40 p-2 dark:border-dark-outline/40"
        >
          <p
            v-if="!linhaAtiva && !buscando && !resultados.length"
            class="px-2 py-8 text-center text-sm text-on-surface-variant"
          >
            Selecione um produto à esquerda.
          </p>
          <p
            v-else-if="buscando"
            class="px-2 py-8 text-center text-sm text-on-surface-variant"
          >
            Buscando imagens…
          </p>
          <p
            v-else-if="!resultados.length"
            class="px-2 py-8 text-center text-sm text-on-surface-variant"
          >
            Clique em «Buscar na Brave» para ver candidatos.
          </p>
          <p v-else class="mb-2 px-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ resultados.length }} imagens. Arraste para o produto ou use Aplicar.
          </p>
          <div
            v-if="resultados.length"
            class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
          >
            <div
              v-for="img in resultados"
              :key="img.link"
              class="flex flex-col overflow-hidden rounded-lg border border-outline/30 bg-surface-container-low dark:border-dark-outline/30 dark:bg-dark-surface-container-low"
              :title="img.title"
            >
              <div class="relative">
                <img
                  :src="img.thumbnailLink || img.link"
                  :alt="img.title"
                  class="aspect-square w-full cursor-grab object-cover active:cursor-grabbing"
                  loading="lazy"
                  draggable="true"
                  referrerpolicy="no-referrer"
                  @dragstart="iniciarArrasteImagem($event, img)"
                >
                <button
                  type="button"
                  class="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  aria-label="Ver imagem maior"
                  title="Ver imagem maior"
                  @click.stop="expandirImagem(img)"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">visibility</span>
                </button>
                <span
                  v-if="aplicandoLink === img.link"
                  class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white"
                >
                  Salvando…
                </span>
              </div>
              <div class="flex flex-col gap-1.5 p-1.5">
                <select
                  class="w-full truncate rounded-md border border-outline/40 bg-surface px-1.5 py-1 text-[11px] text-on-surface dark:border-dark-outline/40 dark:bg-dark-surface dark:text-dark-on-surface"
                  :disabled="bulkRodando || aplicandoLink != null || !linhas.length"
                  :value="destinoIdDaImagem(img.link) ?? ''"
                  @change="definirDestino(img.link, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-if="!linhas.length" value="" disabled>
                    Nenhum produto sem imagem
                  </option>
                  <option
                    v-for="linha in linhas"
                    :key="linha.produtoId"
                    :value="linha.produtoId"
                  >
                    {{ linha.nome }}
                  </option>
                </select>
                <button
                  type="button"
                  class="rounded-md bg-primary-600 px-2 py-1 text-[11px] font-medium text-on-primary disabled:opacity-50"
                  :disabled="bulkRodando || aplicandoLink != null || destinoIdDaImagem(img.link) == null"
                  @click="aplicarResultado(img)"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>

  <Teleport to="body">
    <div
      v-if="imagemExpandida"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Imagem ampliada"
      tabindex="-1"
      @click.self="fecharImagemExpandida"
      @keydown.esc.prevent.stop="fecharImagemExpandida"
    >
      <button
        type="button"
        class="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        aria-label="Fechar imagem"
        @click="fecharImagemExpandida"
      >
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
      <img
        :src="imagemExpandida.link"
        :alt="imagemExpandida.title"
        class="max-h-[90vh] max-w-[90vw] object-contain"
        referrerpolicy="no-referrer"
      >
    </div>
  </Teleport>
</template>
