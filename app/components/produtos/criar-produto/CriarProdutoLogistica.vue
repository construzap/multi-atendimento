<script setup lang="ts">
import BaseInput from '~/components/BaseInput.vue'
import { labelClass, secaoClass, tituloSecaoClass } from './criarProdutoUi'

const props = withDefaults(
  defineProps<{
    idPrefix?: string
  }>(),
  { idPrefix: 'criar-produto' },
)

const pesoKg = defineModel<string>('pesoKg', { default: '' })
const larguraCm = defineModel<string>('larguraCm', { default: '' })
const alturaCm = defineModel<string>('alturaCm', { default: '' })
const comprimentoCm = defineModel<string>('comprimentoCm', { default: '' })
const codigoNcm = defineModel<string>('codigoNcm', { default: '' })

const id = (s: string) => `${props.idPrefix}-${s}`
</script>

<template>
  <section :class="secaoClass">
    <h2 :class="[tituloSecaoClass, 'mb-6']">
      <span class="material-symbols-outlined text-primary-600 dark:text-primary-400" aria-hidden="true">local_shipping</span>
      Logística
    </h2>

    <div class="space-y-4">
      <div>
        <label :for="id('peso')" :class="labelClass">Peso (kg)</label>
        <BaseInput
          :id="id('peso')"
          v-model="pesoKg"
          type="text"
          inputmode="decimal"
          placeholder="0,000"
          autocomplete="off"
        />
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label :for="id('largura')" :class="labelClass">Larg. (cm)</label>
          <BaseInput :id="id('largura')" v-model="larguraCm" type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
        </div>
        <div>
          <label :for="id('altura')" :class="labelClass">Alt. (cm)</label>
          <BaseInput :id="id('altura')" v-model="alturaCm" type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
        </div>
        <div>
          <label :for="id('comprimento')" :class="labelClass">Comp. (cm)</label>
          <BaseInput :id="id('comprimento')" v-model="comprimentoCm" type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
        </div>
      </div>
      <div>
        <label :for="id('ncm')" :class="labelClass">Código NCM</label>
        <BaseInput :id="id('ncm')" v-model="codigoNcm" placeholder="2523.29.10" autocomplete="off" />
      </div>
    </div>
  </section>
</template>
