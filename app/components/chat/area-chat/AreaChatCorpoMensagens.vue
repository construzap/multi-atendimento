<script setup lang="ts">
const imgAnexo =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBTAuFXMjD4WB2qiEmLYSS8ujKZe5YjfOHR9XB0RRkkJCtuuv8HR2wYfOdwrbMtQmPqVGOe4JOszAk07rXQeCWUzgwoSYdqA8BpnVZ56_qE0_6Jjz6wWIEWSdQpr_QV7ozn4Lkb2rcOgUCe1Dan3W2Ua_rHIaBoVxNj_DYoFYLkqqUdMSekrBjVlc0JiU01EzZHpgue2tOphqzlc92DlLtpTVpo1YUxd8sjxhKiyk0DzsivDtn6qoDxud9EI2RgqQbQwT3A5d7iSMI'
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-2">
    <div class="my-6 flex justify-center">
      <span
        class="rounded-full bg-surface-container px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:bg-slate-800 dark:text-slate-400"
      >
        Hoje
      </span>
    </div>

    <div class="mb-4 flex max-w-[70%] flex-col items-start">
      <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-4 shadow-sm dark:bg-slate-800">
        <p class="font-body text-sm text-on-surface dark:text-slate-200">
          Olá! Vi o catálogo que me enviou ontem, mas fiquei com dúvida sobre os prazos.
        </p>
        <span class="mt-1 block text-right text-[10px] text-on-surface-variant dark:text-slate-400">
          14:15
        </span>
      </div>
    </div>

    <div class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
      <div class="rounded-xl rounded-tr-none bg-primary-container p-2 shadow-sm">
        <img :src="imgAnexo" class="mb-2 max-h-64 w-full rounded-lg object-cover" alt="Anexo" />
        <p class="px-2 font-body text-sm text-on-primary-container">
          Este é o nosso hub de logística. Entregamos em 48h!
        </p>
        <div class="mt-1 flex items-center justify-end gap-1 px-2">
          <span class="text-[10px] text-on-primary-container/80">14:18</span>
          <span
            class="material-symbols-outlined text-[12px] text-on-primary-container"
            aria-hidden="true"
          >
            done_all
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
