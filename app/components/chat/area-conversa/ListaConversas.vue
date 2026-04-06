<script setup lang="ts">
import ItemConversa from '~/components/chat/area-conversa/ItemConversa.vue'

type ConversaMock = {
  id: string
  nome: string
  ultimaMensagem: string
  horario: string
  avatarSrc: string | null
}

const imgMariana =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDbVZlXdAZ6XBHm_SGbRjHIby3G4_54N0lq9N1CzypA6L__avxKYHwplmbFpk2ouxD_CqmKx2kBy43ILfsnCWX48pSHEsA7aLigfoEEnr0-zSBjmnazBmZZi2NEpZQXIaNrez6MVByeiGGbg3i__BO68KFcSqerAajF-RqaNgWZ_Esvzm-vjEBvt1PB6UZU47vWfw6s4lI1jeSbilWJx3Illz3Kii5UeczHIlDdCtMW5X5f65qb70uc7zZNunmcZy0ORfY_inNBb0c'

const conversas: ConversaMock[] = [
  {
    id: '1',
    nome: 'Mariana Souza',
    ultimaMensagem: 'Pode me enviar o catálogo de preços atualizado?',
    horario: '14:20',
    avatarSrc: imgMariana
  },
  {
    id: '2',
    nome: 'Pedro Lima',
    ultimaMensagem: 'Obrigado pelo retorno!',
    horario: 'Ontem',
    avatarSrc: null
  },
  {
    id: '3',
    nome: 'Atendimento Loja',
    ultimaMensagem: 'Seu pedido foi despachado.',
    horario: '12:03',
    avatarSrc: null
  }
]
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-2">
    <div class="flex flex-col gap-2">
      <ItemConversa
        v-for="c in conversas"
        :key="c.id"
        :nome="c.nome"
        :ultima-mensagem="c.ultimaMensagem"
        :horario="c.horario"
        :avatar-src="c.avatarSrc"
      />
    </div>
  </div>
</template>
