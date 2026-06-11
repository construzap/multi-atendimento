<script setup lang="ts">
import BaseInput from '~/components/BaseInput.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import ProdutosSelecaoUnica from '~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue'
import { labelClass, secaoClass, tituloSecaoClass, toggleTrackClass } from './criarProdutoUi'

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    /** Prefixo para ids de acessibilidade (ex.: `criar-produto`). */
    idPrefix?: string
  }>(),
  {
    workspaceId: null,
    idPrefix: 'criar-produto',
  },
)

const ativo = defineModel<boolean>('ativo', { default: true })
const nome = defineModel<string>('nome', { default: '' })
const codigo = defineModel<string>('codigo', { default: '' })
const sku = defineModel<string>('sku', { default: '' })
const marca = defineModel<string>('marca', { default: '' })
const descricao = defineModel<string>('descricao', { default: '' })
const categoriaSelecao = defineModel<{ id: number; nome: string } | null>('categoriaSelecao', { default: null })

const id = (s: string) => `${props.idPrefix}-${s}`
</script>

<template>
  <section :class="secaoClass">
    <div class="mb-6 flex items-center justify-between gap-4">
      <h2 :class="tituloSecaoClass">
        <span class="material-symbols-outlined text-primary-600 dark:text-primary-400" aria-hidden="true">info</span>
        Informações Básicas
      </h2>
      <label class="relative inline-flex shrink-0 cursor-pointer items-center">
        <input v-model="ativo" type="checkbox" class="peer sr-only" :aria-labelledby="id('lbl-ativo')" />
        <div :class="toggleTrackClass" aria-hidden="true" />
        <span :id="id('lbl-ativo')" class="ms-3 text-sm font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          Ativo
        </span>
      </label>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label :for="id('nome')" :class="labelClass">Nome do Produto</label>
        <BaseInput
          :id="id('nome')"
          v-model="nome"
          placeholder="Ex: Cimento CP II-E-32 50kg"
          autocomplete="off"
        />
      </div>
      <div>
        <label :for="id('codigo')" :class="labelClass">Código</label>
        <BaseInput :id="id('codigo')" v-model="codigo" placeholder="00123" autocomplete="off" />
      </div>
      <div>
        <label :for="id('sku')" :class="labelClass">SKU Master</label>
        <BaseInput :id="id('sku')" v-model="sku" placeholder="CIM-CP2-50" autocomplete="off" />
      </div>
      <div>
        <label :for="id('marca')" :class="labelClass">Marca</label>
        <BaseInput :id="id('marca')" v-model="marca" placeholder="Ex: Votorantim" autocomplete="off" />
      </div>
      <div>
        <label :for="id('categoria')" :class="labelClass">Categoria</label>
        <ProdutosSelecaoUnica
          variant="form"
          :workspace-id="workspaceId"
          :input-id="id('categoria')"
          v-model:selecao="categoriaSelecao"
          placeholder="Comece a digitar para buscar…"
        />
      </div>
      <div class="sm:col-span-2">
        <label :for="id('descricao')" :class="labelClass">Descrição</label>
        <BaseTextarea
          :id="id('descricao')"
          v-model="descricao"
          placeholder="Detalhes técnicos e diferenciais do produto…"
          :min-height-px="96"
          :max-height-px="240"
          :submit-on-enter="false"
        />
      </div>
    </div>
  </section>
</template>
