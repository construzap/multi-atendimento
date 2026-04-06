<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'

const avatarUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAOZo6VPkN2K253A0sC7xOcVLdGix9JGkrsXMF2VRVYWujxiz6UWB1l4aprwYSrksG7L9I8kBK4QXxPmJi9MEBO3qjdRqXRq6lMkNVPg7f-EMQXQy55saLXaqNXxp3mEZ_jYLszBAgQi-5aPTBDCi8tPDGSikbDcBn3if8Ea4mXBvbGxdOlPuCdgy6CxTzoWvs2FxaoiOv_dC2pE6Vk2zThWxkbYyWr7irP8e5JAhEz2I4hxHBJQalsKp-yGmCTSCZtcTHY2Ja9nNE'

const nome = 'Mariana Souza'
const telefone = '+55 11 98877-6655'
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-white px-6 dark:bg-slate-950"
  >
    <div class="flex min-w-0 items-center gap-3">
      <BaseAvatar :image-url="avatarUrl" :alt="nome" :size="40" variant="circle" />
      <div class="min-w-0">
        <h2 class="truncate font-headline text-base font-semibold text-slate-900 dark:text-slate-100">
          {{ nome }}
        </h2>
        <p class="text-[10px] text-on-surface-variant dark:text-slate-400">
          {{ telefone }}
        </p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2 text-slate-500 dark:text-slate-400">
      <button type="button" class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Vídeo">
        <span class="material-symbols-outlined" aria-hidden="true">videocam</span>
      </button>
      <button type="button" class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Ligar">
        <span class="material-symbols-outlined" aria-hidden="true">call</span>
      </button>
      <button type="button" class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Buscar">
        <span class="material-symbols-outlined" aria-hidden="true">search</span>
      </button>
      <button type="button" class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Mais opções">
        <span class="material-symbols-outlined" aria-hidden="true">more_vert</span>
      </button>
    </div>
  </header>
</template>
