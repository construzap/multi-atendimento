<script setup lang="ts"></script>

<template>
  <div
    id="login-left-section"
    class="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-inverse-surface p-8 md:p-16"
  >
    <div class="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent" />
    <div class="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary-500/5 blur-3xl md:left-20" />
    <div
      class="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-primary-500/5 blur-3xl md:bottom-20 md:right-20"
    />

    <div class="relative z-10 max-w-xl">
      <div class="mb-8">
        <div
          class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-2xl"
        >
          <svg class="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
            />
          </svg>
        </div>
      </div>

      <h1 class="mb-6 text-4xl font-bold leading-tight text-white md:text-5xl">
        Sistema de<br />
        Multi Atendimento
      </h1>

      <p class="mb-8 text-lg leading-relaxed text-gray-300 md:text-xl">
        Gerencie todas as suas conversas em um único lugar. Atendimento eficiente e organizado para sua equipe.
      </p>

      <div class="space-y-4">
        <div class="flex items-start space-x-4">
          <div
            class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-500/20"
          >
            <svg class="h-5 w-5 text-primary-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-white">Múltiplos Canais</h3>
            <p class="text-gray-400">WhatsApp, Telegram, Instagram e muito mais</p>
          </div>
        </div>

        <div class="flex items-start space-x-4">
          <div
            class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-500/20"
          >
            <svg class="h-5 w-5 text-primary-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-white">Atendimento em Tempo Real</h3>
            <p class="text-gray-400">Responda seus clientes instantaneamente</p>
          </div>
        </div>

        <div class="flex items-start space-x-4">
          <div
            class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-500/20"
          >
            <svg class="h-5 w-5 text-primary-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-white">Relatórios Detalhados</h3>
            <p class="text-gray-400">Acompanhe métricas e performance da equipe</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
