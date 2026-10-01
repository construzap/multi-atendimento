<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { LojaFormaPagamento } from '#shared/types/loja'
import { formatarEnderecoLinhas } from '~/components/loja/endereco/enderecosMock'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const ROTULOS: Record<LojaFormaPagamento, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  credito_online: 'Cartão de crédito (online)',
  debito_online: 'Cartão de débito (online)',
  dinheiro: 'Dinheiro na entrega',
  credito_entrega: 'Cartão de crédito na entrega',
  debito: 'Cartão de débito na entrega',
  vale_refeicao: 'Vale refeição',
}

const loja = useLojaWorkspaceStore()
const {
  carrinhoAtual,
  carrinhoTotal,
  observacaoPedido,
  modoRecebimento,
  enderecos,
  enderecoSelecionadoId,
  canal,
  formaPagamento,
} = storeToRefs(loja)

function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function telefoneWhatsapp(raw: string | null | undefined): string {
  const digitos = String(raw ?? '').replace(/\D/g, '')
  if (!digitos) return ''
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return digitos
}

const mensagem = computed(() => {
  const linhasProdutos = carrinhoAtual.value.map((item) => {
    const subtotal = formatPreco(item.preco_unitario * item.quantidade)
    const linha = `- ${item.quantidade}x ${item.nome} — ${subtotal}`
    const obs = item.observacao?.trim()
    return obs ? `${linha}\n  Obs: ${obs}` : linha
  })

  const eEntrega = modoRecebimento.value === 'entrega'
  const endereco = enderecos.value.find((e) => e.id === enderecoSelecionadoId.value)
  const linhasEndereco = eEntrega
    ? (endereco ? formatarEnderecoLinhas(endereco) : ['Nenhum endereço selecionado.'])
    : [canal.value?.endereco?.trim() || 'Endereço da loja não informado.']

  const forma = formaPagamento.value
  const partes = [
    'Acabei de fazer esse pedido pelo site:',
    '',
    'Produtos:',
    linhasProdutos.length ? linhasProdutos.join('\n') : '- (nenhum item)',
    '',
    `Total: ${formatPreco(carrinhoTotal.value)}`,
  ]

  if (eEntrega) {
    partes.push('', 'Taxa de entrega: a ser calculado')
  }

  partes.push(
    '',
    eEntrega ? 'Endereço:' : 'Retirada:',
    linhasEndereco.join('\n'),
    '',
    `Forma de pagamento: ${forma ? ROTULOS[forma] : 'Não selecionada'}`,
  )

  const obsPedido = observacaoPedido.value.trim()
  if (obsPedido) {
    partes.push('', 'Observações:', obsPedido)
  }

  return partes.join('\n')
})

const linkWhatsapp = computed(() => {
  const numero = telefoneWhatsapp(canal.value?.connect_phone)
  if (!numero) return ''
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem.value)}`
})
</script>

<template>
  <section class="flex flex-1 flex-col items-center px-4 pt-16 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#00C853]/15 text-[#00C853]">
      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h2 class="mt-5 text-xl font-semibold text-on-surface dark:text-dark-on-surface">
      Pedido enviado para a loja
    </h2>
    <p class="mt-2 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Avise a loja no WhatsApp com o resumo do pedido.
    </p>

    <a
      v-if="linkWhatsapp"
      :href="linkWhatsapp"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-8 flex h-14 w-full max-w-lg items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-base font-semibold text-white shadow-lg"
    >
      Chamar no WhatsApp
    </a>
    <p
      v-else
      class="mt-8 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      O WhatsApp da loja ainda não está cadastrado.
    </p>
  </section>
</template>
