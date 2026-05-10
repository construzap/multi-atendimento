<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { PerfilAssinatura } from '#shared/types/profile'
import BaseButton from '~/components/BaseButton.vue'
import AssinaturaStatusCard from '~/components/assinatura/AssinaturaStatusCard.vue'
import AssinaturaVencimentoCard from '~/components/assinatura/AssinaturaVencimentoCard.vue'
import AssinaturaCanaisCard from '~/components/assinatura/AssinaturaCanaisCard.vue'
import ModalPacotesCheckout from '~/components/assinatura/ModalPacotesCheckout.vue'

definePageMeta({
  layout: 'default'
})

const { data, pending, error, refresh } = await useFetch<PerfilAssinatura>('/api/perfil/assinatura', {
  server: false
})

const erroTexto = computed(() => {
  const e = error.value as Error & { data?: { statusMessage?: string; message?: string } } | null
  if (!e) return null
  return (
    e.data?.statusMessage ??
    e.data?.message ??
    e.message ??
    'Não foi possível carregar os dados da assinatura.'
  )
})

const textoBotaoCta = computed(() => {
  const s = data.value?.status_assinatura
  if (s === 'ativo') return 'Gerenciar assinatura'
  return 'Assinar'
})

const checkoutPending = ref(false)
const modalPacotesOpen = ref(false)

function abrirStripeEmNovaGuia(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function fetchErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const d = (err as { data?: { message?: string; statusMessage?: string } }).data
    const m = d?.message ?? d?.statusMessage
    if (m) return String(m)
  }
  return err instanceof Error ? err.message : ''
}

function onCtaAssinatura() {
  const s = data.value?.status_assinatura
  if (s === 'ativo') {
    void abrirPortalCliente()
    return
  }

  modalPacotesOpen.value = true
}

async function abrirPortalCliente() {
  checkoutPending.value = true
  try {
    const origin = window.location.origin
    const res = await $fetch<{ url: string }>('/api/stripe/portal', {
      method: 'POST',
      body: {
        return_url: `${origin}/assinatura`
      }
    })

    if (!res.url) {
      toast.error('O Stripe não retornou URL do portal.')
      return
    }

    abrirStripeEmNovaGuia(res.url)
  } catch (err: unknown) {
    toast.error(
      fetchErrorMessage(err) || 'Não foi possível abrir o portal do cliente.'
    )
  } finally {
    checkoutPending.value = false
  }
}

async function iniciarCheckoutStripe(pacotes: number) {
  checkoutPending.value = true
  try {
    const origin = window.location.origin
    const res = await $fetch<{ url: string }>('/api/stripe/checkout', {
      method: 'POST',
      body: {
        quantity: pacotes,
        success_url: `${origin}/assinatura?checkout=success`,
        cancel_url: `${origin}/assinatura?checkout=cancel`
      }
    })

    if (!res.url) {
      toast.error('O Stripe não retornou URL de checkout.')
      return
    }

    abrirStripeEmNovaGuia(res.url)
  } catch (err: unknown) {
    toast.error(
      fetchErrorMessage(err) || 'Não foi possível abrir o checkout.'
    )
  } finally {
    checkoutPending.value = false
  }
}
</script>

<template>
  <ModalPacotesCheckout v-model:open="modalPacotesOpen" @confirm="iniciarCheckoutStripe" />

  <div class="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Assinatura
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Acompanhe o status do plano, vencimento da fatura e uso dos canais.
      </p>
    </header>

    <div
      v-if="pending"
      class="h-56 animate-pulse rounded-2xl bg-surface-container-high dark:bg-dark-surface-container-high"
      aria-busy="true"
      aria-live="polite"
    />

    <div
      v-else-if="erroTexto"
      class="rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
      role="alert"
    >
      <p class="font-body text-sm text-danger-on-container dark:text-dark-on-danger-container">
        {{ erroTexto }}
      </p>
      <BaseButton class="mt-4" type="button" @click="() => refresh()">
        Tentar novamente
      </BaseButton>
    </div>

    <div
      v-else-if="data"
      class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <AssinaturaStatusCard :status="data.status_assinatura" />
      <AssinaturaVencimentoCard :data-expiracao="data.data_expiracao" :status="data.status_assinatura" />
      <AssinaturaCanaisCard :canais="data.canais" :canais-criados="data.canais_criados" />

      <div
        class="border-t border-outline/30 px-5 pb-5 pt-4 dark:border-dark-outline/30"
      >
        <BaseButton
          size="sm"
          type="button"
          :disabled="checkoutPending"
          @click="onCtaAssinatura"
        >
          {{ checkoutPending ? 'Abrindo…' : textoBotaoCta }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
