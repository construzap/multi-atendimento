<script setup lang="ts">
import ItemAnotacao from '~/components/chat/area-info-conversa/ItemAnotacao.vue'

type Item = {
  id: string
  autor: string
  dataHora: string
  texto: string
  anexos?: { nome: string }[]
}

/** Mock — substituir por dados da API / store */
const itens: Item[] = [
  {
    id: '1',
    autor: 'Arthur Mendes',
    dataHora: 'hoje às 14:30',
    texto:
      'Cliente demonstrou interesse no plano trimestral. Verificar estoque do item X.',
    anexos: [{ nome: 'briefing.pdf' }],
  },
]
</script>

<template>
  <section class="space-y-4 px-6">
    <div class="flex items-center justify-between">
      <h3 class="font-headline text-sm font-bold text-slate-900 dark:text-slate-100">
        Anotações Internas
      </h3>
      <button type="button" class="text-primary" aria-label="Nova anotação">
        <span class="material-symbols-outlined text-lg" aria-hidden="true">add_comment</span>
      </button>
    </div>

    <div class="space-y-3">
      <ItemAnotacao
        v-for="item in itens"
        :key="item.id"
        :autor="item.autor"
        :data-hora="item.dataHora"
        :texto="item.texto"
        :anexos="item.anexos"
      />
    </div>
  </section>
</template>
