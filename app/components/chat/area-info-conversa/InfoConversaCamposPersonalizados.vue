<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'

const avatarResponsavel =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuByfVTCP6d7nH8Kr5R-EIkTDgfuJBvprjkSC4kyiC-JZpokwUrf70v68cb_Sd5vHV-PBcdEfQaJUR4kIRh2D2jzpFbWi0OTj0vKbs6CfILdF6ifb0Al5PpZ_3tQKMHUqbJmeNcXECFw6J5sDv6Cz_E5Ic_hKWprXfmuYRUeSaKSS12LlSqna8eNumru7p7IDUqsqrJr5lHUrUiLSV5dHvPGhJiAYwbVq9F8NudffJvHU5YUCF3SpSr1-b_uiyT24c2fYn-gxUBCWuE'

const nomeResponsavel = 'Arthur Mendes'
</script>

<template>
  <section class="space-y-4 p-6">
    <div>
      <label
        class="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400"
      >
        Status do Funil
      </label>
      <div class="relative">
        <select
          class="w-full appearance-none rounded-lg border border-outline-variant/30 bg-white py-2 pl-3 pr-10 font-body text-sm focus:ring-primary dark:bg-slate-800 dark:text-slate-200"
        >
          <option>Novo Lead</option>
          <option selected>Qualificação</option>
          <option>Proposta Enviada</option>
          <option>Negociação</option>
        </select>
        <span
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined"
          aria-hidden="true"
        >
          expand_more
        </span>
      </div>
    </div>

    <div>
      <label
        class="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400"
      >
        Valor Estimado (R$)
      </label>
      <input
        type="number"
        value="12500"
        class="w-full rounded-lg border border-outline-variant/30 bg-white py-2 pl-3 pr-3 font-body text-sm focus:ring-primary dark:bg-slate-800 dark:text-slate-200"
      />
    </div>

    <div>
      <label
        class="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400"
      >
        Responsável
      </label>
      <div
        class="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-white p-2 dark:bg-slate-800"
      >
        <BaseAvatar
          :image-url="avatarResponsavel"
          :alt="nomeResponsavel"
          :size="24"
          variant="circle"
        />
        <span class="text-sm dark:text-slate-300">{{ nomeResponsavel }}</span>
      </div>
    </div>
  </section>
</template>
