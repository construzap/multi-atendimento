<script setup lang="ts">
import { ref } from 'vue'
import BaseAvatar from '~/components/BaseAvatar.vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'

const pesquisa = ref('')

/** Estado da sessão WhatsApp (mock — ligar a API depois). */
const conectado = ref(true)

function alternarConexao() {
  conectado.value = !conectado.value
}

/** Dados de exemplo — substituir por props/store quando houver canal/workspace. */
const nomeCanal = 'Clínica Vida'
const nomeWhatsApp = 'Recepção — Clínica Vida'
const telefone = '+55 11 99999-9999'

const fotoPerfil =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC3d5B4ttA2NujNvylJb-vOJWthOp-OKHSgx00fBgd4D4tQZIrd4akugMwGi1kqNu4skNGJ7DTjv9UmgRMFVU8nqKCvuebn-Yh-jF7IprNG2_f8iUyqbz_6ELFrXNlLNBngzGY7fv8K8-PiIg5AnrecRJ9OWYgPa1hcBOSdayysSUi8sZWbVDRtDK4j_foSWyd9Fr15WezuPeELGsY2C2Ex-IDvnYnkRutezlhQ8GmgPALkvvhaaZI8CEoaY_XmNv3IdUOK2BQaWZU'
</script>

<template>
  <div class="shrink-0 border-b border-slate-200/80 bg-white/80 dark:border-slate-700/80 dark:bg-slate-900/40">
    <!-- Linha 1: nome do canal + configurações (tema só no botão flutuante global) -->
    <div class="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
      <h2
        class="min-w-0 flex-1 truncate font-headline text-lg font-bold leading-tight text-slate-900 dark:text-slate-100"
        :title="nomeCanal"
      >
        {{ nomeCanal }}
      </h2>
      <button
        type="button"
        class="shrink-0 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Configurações do canal"
      >
        <span class="material-symbols-outlined text-2xl" aria-hidden="true">settings</span>
      </button>
    </div>

    <!-- Linha 2: avatar, nome WhatsApp, telefone; à direita badge + ação -->
    <div class="flex items-center gap-3 px-4 pb-4">
      <div class="relative shrink-0">
        <BaseAvatar
          :src="fotoPerfil"
          alt="Foto do perfil WhatsApp"
          text="EU"
          :size="48"
          variant="circle"
          class="border-2 border-primary-container"
        />
        <span
          class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-slate-900"
          aria-hidden="true"
        />
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate font-headline font-semibold text-slate-900 dark:text-slate-100">
          {{ nomeWhatsApp }}
        </p>
        <p class="mt-0.5 text-xs text-on-surface-variant dark:text-slate-400">
          {{ telefone }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-2">
        <span
          class="inline-flex max-w-[12rem] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          :class="
            conectado
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          "
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">
            {{ conectado ? 'wifi' : 'wifi_off' }}
          </span>
          {{ conectado ? 'Conectado' : 'Desconectado' }}
        </span>
        <BaseButton
          type="button"
          :variant="conectado ? 'secondary' : 'primary'"
          size="sm"
          :block="false"
          class="!px-3"
          @click="alternarConexao"
        >
          {{ conectado ? 'Desconectar' : 'Conectar' }}
        </BaseButton>
      </div>
    </div>

    <div class="border-t border-slate-100 px-4 pb-4 pt-2 dark:border-slate-800">
      <BaseInput
        id="conversas-pesquisa"
        v-model="pesquisa"
        type="search"
        name="pesquisa-conversas"
        placeholder="Buscar conversas…"
        autocomplete="off"
        wrapper-id="conversas-pesquisa-wrap"
      >
        <template #leading>
          <svg
            class="h-5 w-5 text-gray-400 dark:text-dark-on-surface-variant/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" stroke-linecap="round" />
          </svg>
        </template>
      </BaseInput>
    </div>
  </div>
</template>
