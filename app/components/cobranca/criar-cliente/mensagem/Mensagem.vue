<script setup lang="ts">
const templateMensagem = defineModel<string>('templateMensagem', { required: true })
const templateMensagemVencida = defineModel<string>('templateMensagemVencida', { required: true })

const variaveis = [
  { label: 'Saudação', token: '{saudacao}' },
  { label: 'Nome do Cliente', token: '{cliente}' },
  { label: 'Valor', token: '{valor}' },
  { label: 'Vencimento', token: '{vencimento}' },
  { label: 'Produtos', token: '{produtos}' },
]

function inserirToken(alvo: 'emDia' | 'vencida', token: string) {
  const model = alvo === 'emDia' ? templateMensagem : templateMensagemVencida
  const atual = model.value ?? ''
  const precisaEspaco = atual !== '' && !atual.endsWith(' ') && !atual.endsWith('\n')
  model.value = `${atual}${precisaEspaco ? ' ' : ''}${token}`
}

const textareaClass =
  'w-full resize-none rounded-xl border border-outline/40 bg-surface-container-lowest px-3.5 py-3 font-body text-sm leading-relaxed text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20'
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <p class="font-label text-sm font-semibold uppercase tracking-wide text-primary dark:text-dark-primary">
        Passo 4
      </p>
      <h2 class="font-headline text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
        Mensagem de WhatsApp
      </h2>
    </header>

    <div class="grid gap-5 lg:grid-cols-2">
      <!-- Mensagem em dia -->
      <div
        class="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary-50/40 p-5 dark:border-dark-primary/30 dark:bg-dark-primary-container/15"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-dark-primary-container/50 dark:text-dark-primary"
            aria-hidden="true"
          >
            <svg class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <div>
            <h3 class="font-label text-base font-semibold text-on-surface dark:text-dark-on-surface">
              Antes do vencimento
            </h3>
            <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Cobrança em dia
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="variavel in variaveis"
            :key="`antes-${variavel.token}`"
            type="button"
            class="rounded-lg border border-primary/40 bg-surface-container-lowest px-2.5 py-1.5 font-label text-xs font-semibold text-primary transition hover:bg-primary-100 dark:border-dark-primary/40 dark:bg-dark-surface-container-low dark:text-dark-primary dark:hover:bg-dark-primary-container/40"
            :title="variavel.label"
            @click="inserirToken('emDia', variavel.token)"
          >
            {{ variavel.token }}
          </button>
        </div>

        <textarea
          v-model="templateMensagem"
          rows="7"
          :class="textareaClass"
          placeholder="Escreva a mensagem… Clique nas variáveis acima para inserir."
        />
      </div>

      <!-- Mensagem vencida -->
      <div
        class="flex flex-col gap-4 rounded-2xl border border-danger/25 bg-danger/5 p-5 dark:border-dark-danger/35 dark:bg-dark-danger/10"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger dark:bg-dark-danger/25 dark:text-dark-danger"
            aria-hidden="true"
          >
            <svg class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M12 9v4M12 17h.01" stroke-linecap="round" />
            </svg>
          </span>
          <div>
            <h3 class="font-label text-base font-semibold text-on-surface dark:text-dark-on-surface">
              Cobrança vencida
            </h3>
            <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Após o vencimento
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="variavel in variaveis"
            :key="`vencida-${variavel.token}`"
            type="button"
            class="rounded-lg border border-danger/35 bg-surface-container-lowest px-2.5 py-1.5 font-label text-xs font-semibold text-danger transition hover:bg-danger/10 dark:border-dark-danger/40 dark:bg-dark-surface-container-low dark:text-dark-danger dark:hover:bg-dark-danger/20"
            :title="variavel.label"
            @click="inserirToken('vencida', variavel.token)"
          >
            {{ variavel.token }}
          </button>
        </div>

        <textarea
          v-model="templateMensagemVencida"
          rows="7"
          :class="textareaClass"
          placeholder="Escreva a mensagem… Clique nas variáveis acima para inserir."
        />
      </div>
    </div>
  </section>
</template>
