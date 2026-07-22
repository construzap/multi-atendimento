<script setup lang="ts">
import type { Ref } from 'vue'

const templateMensagem = defineModel<string>('templateMensagem', { required: true })
const templateMensagemVencida = defineModel<string>('templateMensagemVencida', { required: true })

const variaveis = [
  { label: 'Saudação', token: '{saudacao}' },
  { label: 'Nome do Cliente', token: '{cliente}' },
  { label: 'Valor', token: '{valor}' },
  { label: 'Vencimento', token: '{vencimento}' },
  { label: 'Produtos', token: '{produtos}' },
]

function inserirNoTemplate(model: Ref<string>, token: string) {
  const atual = model.value ?? ''
  model.value = `${atual}${atual.endsWith(' ') || atual === '' ? '' : ' '}${token}`.trimStart()
}
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <p class="font-label text-sm font-semibold uppercase tracking-wide text-primary dark:text-dark-primary">
        Passo 4
      </p>
      <h2 class="font-headline text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
        Mensagem de WhatsApp
      </h2>
      <p class="max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
        Defina o texto da cobrança em dia e o texto usado quando a cobrança já estiver vencida.
      </p>
    </header>

    <div class="space-y-4">
      <div class="space-y-3">
        <div>
          <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
            Template da mensagem (antes do vencimento)
          </label>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="variavel in variaveis"
              :key="`antes-${variavel.token}`"
              type="button"
              class="rounded-lg border border-primary/40 bg-primary-50 px-3 py-2 font-label text-sm font-semibold text-primary transition hover:bg-primary-100 dark:border-dark-primary/40 dark:bg-dark-primary-container/30 dark:text-dark-primary"
              @click="inserirNoTemplate(templateMensagem, variavel.token)"
            >
              {{ variavel.token }}
            </button>
          </div>
        </div>
        <textarea
          v-model="templateMensagem"
          rows="6"
          class="w-full resize-none rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2.5 font-body text-sm leading-relaxed text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20"
        />
        <div class="rounded-2xl border border-outline/30 bg-surface-container-low p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container">
          <p class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Prévia
          </p>
          <p class="mt-1.5 whitespace-pre-line font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ templateMensagem }}
          </p>
        </div>
      </div>

      <div class="space-y-3 border-t border-outline/20 pt-4 dark:border-dark-outline/20">
        <div>
          <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
            Template da mensagem (cobrança vencida)
          </label>
          <p class="mt-1 font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            Usado quando o status da cobrança estiver vencido.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="variavel in variaveis"
              :key="`vencida-${variavel.token}`"
              type="button"
              class="rounded-lg border border-primary/40 bg-primary-50 px-3 py-2 font-label text-sm font-semibold text-primary transition hover:bg-primary-100 dark:border-dark-primary/40 dark:bg-dark-primary-container/30 dark:text-dark-primary"
              @click="inserirNoTemplate(templateMensagemVencida, variavel.token)"
            >
              {{ variavel.token }}
            </button>
          </div>
        </div>
        <textarea
          v-model="templateMensagemVencida"
          rows="6"
          class="w-full resize-none rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2.5 font-body text-sm leading-relaxed text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20"
        />
        <div class="rounded-2xl border border-outline/30 bg-surface-container-low p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container">
          <p class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Prévia (vencida)
          </p>
          <p class="mt-1.5 whitespace-pre-line font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ templateMensagemVencida }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
