<script setup lang="ts">
import { computed } from 'vue'
import { labelClass, secaoClass, tituloSecaoClass } from './criarProdutoUi'
import type { CriarProdutoTipoImagensVariacao, CriarProdutoVariacaoLinha } from './types'

withDefaults(
  defineProps<{
    idPrefix?: string
  }>(),
  { idPrefix: 'criar-produto' },
)

const tipoImagens = defineModel<CriarProdutoTipoImagensVariacao>('tipoImagens', { default: 'diferentes' })
const linhas = defineModel<CriarProdutoVariacaoLinha[]>('linhas', {
  default: () => [
    {
      id: 'VAR-01',
      rotulo: 'Cor: Preto',
      sku: 'CIM-CP2-50-PR',
      preco: '32,90',
      disponivel: true,
      imagemUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAvJ6fpb1nIoCjVFPzPNAYTL8z2aovowvbmGFpbdZaApyMLaiPhjeykEo7YeTgiPmK8-Xscxb9D1IBNarBUG5DnZVi9OPlVqYrgvBliCfuBExUyIQyM0JN9ZW6Im90178o5f4adA975TLV7vvPeEQvDcmA64x4L7chUmLF5oewCYbi5qXHOKnRUuWQcpe3oNQiw4XeTv4rC7rSkA22UUrU--3mKYqiC-CmMrWIGtCb9zpAoSTgjJ7RjsDtQCWWF48sfK4m-aKH4Bic',
    },
    {
      id: 'VAR-02',
      rotulo: 'Cor: Cinza',
      sku: 'CIM-CP2-50-CZ',
      preco: '29,90',
      disponivel: true,
      imagemUrl: null,
    },
  ],
})

let contadorVariacao = 3

const thClass =
  'p-3 text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant'
const tdClass = 'p-3 text-sm text-on-surface dark:text-dark-on-surface'

const gruposParaImagens = computed(() => {
  const map = new Map<string, CriarProdutoVariacaoLinha[]>()
  for (const l of linhas.value) {
    const chave = l.rotulo.split(':')[0]?.trim() || 'Variação'
    const arr = map.get(chave) ?? []
    arr.push(l)
    map.set(chave, arr)
  }
  return [...map.entries()]
})

function adicionarVariacao() {
  const n = contadorVariacao++
  const id = `VAR-${String(n).padStart(2, '0')}`
  linhas.value = [
    ...linhas.value,
    {
      id,
      rotulo: `Opção ${n}`,
      sku: '',
      preco: '',
      disponivel: true,
      imagemUrl: null,
    },
  ]
}

function removerLinha(index: number) {
  linhas.value = linhas.value.filter((_, i) => i !== index)
}

function removerImagem(linha: CriarProdutoVariacaoLinha) {
  linha.imagemUrl = null
}
</script>

<template>
  <section :class="[secaoClass, 'space-y-6']">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 :class="tituloSecaoClass">
        <span class="material-symbols-outlined text-primary-600 dark:text-primary-400" aria-hidden="true">layers</span>
        Variações
      </h2>
      <button
        type="button"
        class="inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:underline dark:text-primary-400"
        @click="adicionarVariacao"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add_circle</span>
        Adicionar nova variação
      </button>
    </div>

    <div class="rounded-xl bg-surface-container-low p-4 dark:bg-dark-surface-container-low">
      <div class="mb-6 flex flex-wrap items-center gap-4 sm:gap-8">
        <span :class="labelClass" class="mb-0">Imagens das Variações:</span>
        <div class="flex flex-wrap items-center gap-4">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              v-model="tipoImagens"
              type="radio"
              name="criar-produto-img-type"
              value="iguais"
              class="h-4 w-4 border-outline/50 text-primary-600 focus:ring-primary-500/35"
            />
            <span class="text-sm text-on-surface dark:text-dark-on-surface">IGUAIS</span>
          </label>
          <label class="flex cursor-pointer items-center gap-2">
            <input
              v-model="tipoImagens"
              type="radio"
              name="criar-produto-img-type"
              value="diferentes"
              class="h-4 w-4 border-outline/50 text-primary-600 focus:ring-primary-500/35"
            />
            <span class="text-sm text-on-surface dark:text-dark-on-surface">DIFERENTES</span>
          </label>
        </div>
      </div>

      <div
        v-if="tipoImagens === 'diferentes'"
        class="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <div
          v-for="[grupo, itens] in gruposParaImagens"
          :key="grupo"
          class="rounded-lg border border-outline/30 bg-surface-container-lowest p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-lowest"
        >
          <p class="mb-3 text-sm font-bold text-on-surface dark:text-dark-on-surface">{{ grupo }}</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="item in itens"
              :key="item.id"
              class="flex flex-col gap-1"
            >
              <span class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">{{ item.rotulo }}</span>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex h-16 w-16 cursor-pointer items-center justify-center rounded border-2 border-dashed border-outline/40 transition-colors hover:border-primary-500 dark:border-dark-outline/45"
                  aria-label="Adicionar foto"
                >
                  <span class="material-symbols-outlined text-outline dark:text-dark-outline">add_a_photo</span>
                </button>
                <div
                  v-if="item.imagemUrl"
                  class="group relative h-16 w-16 overflow-hidden rounded bg-surface-container dark:bg-dark-surface-container"
                >
                  <img :src="item.imagemUrl" :alt="item.rotulo" class="h-full w-full object-cover" loading="lazy" />
                  <div
                    class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <button
                      type="button"
                      class="text-white"
                      aria-label="Remover imagem"
                      @click="removerImagem(item)"
                    >
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p
        v-else
        class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Todas as variações partilham as mesmas imagens do produto principal (configuração na página).
      </p>
    </div>

    <div class="overflow-hidden rounded-xl border border-outline/30 dark:border-dark-outline/30">
      <table class="w-full border-collapse text-left">
        <thead class="bg-surface-container-high dark:bg-dark-surface-container-high">
          <tr>
            <th :class="thClass">ID</th>
            <th :class="thClass">Opções</th>
            <th :class="thClass">SKU</th>
            <th :class="thClass">Preço (R$)</th>
            <th :class="[thClass, 'text-center']">Disponível</th>
            <th :class="[thClass, 'text-right']">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline/20 dark:divide-dark-outline/20">
          <tr
            v-for="(linha, index) in linhas"
            :key="linha.id"
            class="transition-colors hover:bg-surface-container-low/80 dark:hover:bg-dark-surface-container-low/80"
          >
            <td :class="[tdClass, 'text-xs text-on-surface-variant dark:text-dark-on-surface-variant']">#{{ linha.id }}</td>
            <td :class="tdClass">
              <span
                class="inline-block rounded-full bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-300"
              >
                {{ linha.rotulo }}
              </span>
            </td>
            <td :class="tdClass">{{ linha.sku || '—' }}</td>
            <td :class="tdClass">{{ linha.preco || '—' }}</td>
            <td :class="[tdClass, 'text-center']">
              <input
                v-model="linha.disponivel"
                type="checkbox"
                class="rounded border-outline/50 text-primary-600 focus:ring-primary-500/35"
              />
            </td>
            <td :class="[tdClass, 'text-right']">
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-dark-surface-container-highest"
                  aria-label="Editar variação"
                >
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button
                  type="button"
                  class="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  aria-label="Eliminar variação"
                  @click="removerLinha(index)"
                >
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!linhas.length">
            <td colspan="6" class="p-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
              Nenhuma variação. Clique em «Adicionar nova variação».
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
