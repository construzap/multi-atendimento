<script setup lang="ts">
import { labelClass, secaoClass, selectClass, tituloSecaoClass } from './criarProdutoUi'

const props = withDefaults(
  defineProps<{
    idPrefix?: string
  }>(),
  { idPrefix: 'criar-produto' },
)

const precoCusto = defineModel<string>('precoCusto', { default: '' })
const precoVista = defineModel<string>('precoVista', { default: '' })
const precoPrazo = defineModel<string>('precoPrazo', { default: '' })
const precoPromocional = defineModel<string>('precoPromocional', { default: '' })
const estoqueInicial = defineModel<string>('estoqueInicial', { default: '0' })
const unidadeVenda = defineModel<string>('unidadeVenda', { default: '' })

const opcoesUnidade = [
  { value: '', label: 'Selecione a unidade' },
  { value: 'UN', label: 'Unidade (UN)' },
  { value: 'SC', label: 'Saco (SC)' },
  { value: 'KG', label: 'Quilo (KG)' },
  { value: 'M', label: 'Metro (M)' },
] as const

const id = (s: string) => `${props.idPrefix}-${s}`

const inputMoedaClass =
  'w-full rounded-lg border border-outline/40 bg-surface-container-lowest py-3 pl-10 pr-3 text-sm text-on-surface shadow-sm transition-colors placeholder:text-outline/50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface dark:focus:border-primary-400'
</script>

<template>
  <section :class="secaoClass">
    <h2 :class="[tituloSecaoClass, 'mb-6']">
      <span class="material-symbols-outlined text-primary-600 dark:text-primary-400" aria-hidden="true">payments</span>
      Preços e Estoque
    </h2>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      <div>
        <label :for="id('preco-custo')" :class="labelClass">Preço de Custo</label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">R$</span>
          <input
            :id="id('preco-custo')"
            v-model="precoCusto"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0,00"
            :class="inputMoedaClass"
          />
        </div>
      </div>
      <div>
        <label :for="id('preco-vista')" :class="labelClass">Preço à Vista</label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">R$</span>
          <input
            :id="id('preco-vista')"
            v-model="precoVista"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0,00"
            :class="inputMoedaClass"
          />
        </div>
      </div>
      <div>
        <label :for="id('preco-prazo')" :class="labelClass">Preço à Prazo</label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">R$</span>
          <input
            :id="id('preco-prazo')"
            v-model="precoPrazo"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0,00"
            :class="inputMoedaClass"
          />
        </div>
      </div>
      <div>
        <label :for="id('preco-promo')" :class="labelClass">Preço Promocional</label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">R$</span>
          <input
            :id="id('preco-promo')"
            v-model="precoPromocional"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0,00"
            :class="inputMoedaClass"
          />
        </div>
      </div>
      <div>
        <label :for="id('estoque')" :class="labelClass">Estoque Inicial</label>
        <input
          :id="id('estoque')"
          v-model="estoqueInicial"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          class="w-full rounded-lg border border-outline/40 bg-surface-container-lowest p-3 text-sm text-on-surface shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest dark:text-dark-on-surface dark:focus:border-primary-400"
        />
      </div>
      <div>
        <label :for="id('unidade')" :class="labelClass">Unidade de Venda</label>
        <select :id="id('unidade')" v-model="unidadeVenda" :class="selectClass">
          <option v-for="op in opcoesUnidade" :key="op.value" :value="op.value">{{ op.label }}</option>
        </select>
      </div>
    </div>
  </section>
</template>
