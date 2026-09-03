<script setup lang="ts">
import AdminAcessoNegado from '~/components/admin/pagina_inicial/AdminAcessoNegado.vue'
import DetalheCustoCanal from '~/components/admin/custos_ia/DetalheCustoCanal.vue'
import { parseCustoIaCanalParam } from '~/stores/adminCustosIa'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const { pending, isAdmin, erroTexto } = useAdminGate()

const canalParam = computed(() => parseCustoIaCanalParam(route.params.canalId))

const paramsValidos = computed(() => canalParam.value !== undefined)

const canalId = computed(() => (canalParam.value === undefined ? null : canalParam.value))
</script>

<template>
  <div class="min-h-full bg-white dark:bg-dark-background">
    <AdminAcessoNegado v-if="!pending && !erroTexto && !isAdmin" />

    <div
      v-else-if="pending"
      class="mx-auto w-full max-w-7xl px-4 py-16 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant md:px-6"
    >
      Verificando permissões...
    </div>

    <div
      v-else-if="erroTexto"
      class="mx-auto w-full max-w-lg px-4 py-16 text-center md:px-6"
    >
      <p class="text-sm text-danger dark:text-dark-danger">
        {{ erroTexto }}
      </p>
    </div>

    <div v-else class="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header class="mb-8">
        <NuxtLink
          to="/admin/custos-da-ia"
          class="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary-600 dark:text-dark-on-surface-variant dark:hover:text-dark-primary"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Voltar aos custos da I.A
        </NuxtLink>
        <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
          Custos do canal
        </h1>
        <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Total do canal e médias do período
        </p>
      </header>

      <p
        v-if="!paramsValidos"
        class="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-6 text-sm text-danger dark:text-dark-danger"
      >
        Canal inválido.
      </p>

      <DetalheCustoCanal
        v-else
        :canal-id="canalId"
      />
    </div>
  </div>
</template>
