import type { CanalHorarios } from '#shared/types/canal'

/** Workspace exposto na loja pública (campos mínimos). */
export type LojaWorkspacePublico = {
  id: number
  nome: string
  logo_url: string | null
}

/** Métodos ativos do canal (só as chaves `true` de `canais.formas_pagamento`). */
export type LojaFormasPagamentoPublico = {
  online: string[]
  entrega: string[]
}

/** Canal da vitrine pública (whitelist; sem token, chave ou credencial). */
export type LojaCanalPublico = {
  id: number
  workspace_id: number
  longitude: number | null
  latitude: number | null
  horarios: CanalHorarios | null
  tempo_aviso_minutos: number
  endereco: string | null
  loja_aberta: boolean
  agenda_pedido: boolean
  valor_pedido_minimo: number
  formas_pagamento: LojaFormasPagamentoPublico
}

/** Termo de pesquisa usado como categoria/aba da vitrine. */
export type LojaTermoPublico = {
  id: number
  nome: string
  ordem: number
}

/** Produto da lista pública (foto principal; sem custo nem campos internos). */
export type LojaProdutoPublico = {
  id: number
  termo_id: number
  ordem: number
  nome: string
  descricao: string | null
  preco: number | null
  preco_promocional: number | null
  imagem_url: string | null
}

/** Payload único da primeira pintura (`GET /api/public/loja/workspace/:slug`). */
export type LojaCardapioPublico = {
  workspace: LojaWorkspacePublico
  canal: LojaCanalPublico
  termos: LojaTermoPublico[]
  produtos: LojaProdutoPublico[]
  total: number
  has_more: boolean
}

export type LojaWorkspacePublicoResponse = {
  ok: true
  data: LojaCardapioPublico
}

/** Item do carrinho da loja pública (persistido no localStorage). */
export type LojaCarrinhoItem = {
  chave: string
  produto_id: number
  nome: string
  imagem_url: string | null
  preco_unitario: number
  quantidade: number
  observacao: string
}

export type LojaModoRecebimento = 'entrega' | 'retirada'

export type LojaEndereco = {
  id: number
  conversa_key?: string
  workspace_id?: number
  id_canal?: number
  rua: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  uf: string
  cep: string
  ponto_referencia?: string | null
  apelido?: string | null
  padrao?: boolean
  lat?: number | null
  lon?: number | null
}

export type LojaEnderecoCreate = {
  rua: string
  numero: string
  complemento?: string | null
  bairro: string
  cidade: string
  uf: string
  cep: string
  ponto_referencia?: string | null
  apelido?: string | null
  padrao?: boolean
  lat?: number | null
  lon?: number | null
}

export type LojaEnderecosListaResponse = {
  ok: true
  data: LojaEndereco[]
}

export type LojaEnderecoItemResponse = {
  ok: true
  data: LojaEndereco
}

export type LojaGeocodeReverso = {
  enderecoCompleto: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  pais: string
  lat: number
  lon: number
}

export type LojaCepLookup = {
  cep: string
  rua: string
  bairro: string
  cidade: string
  estado: string
  complemento: string
  lat: number | null
  lon: number | null
}

export type LojaFormaPagamento =
  | 'pix'
  | 'boleto'
  | 'credito_online'
  | 'debito_online'
  | 'dinheiro'
  | 'credito_entrega'
  | 'debito'
  | 'vale_refeicao'

/** Dados do cliente na loja pública (sem sessão do SaaS). */
export type LojaLogin = {
  nome: string
  celular: string
  cpf: string
  key: string
}

export type LojaLoginBuscaResponse = {
  ok: true
  encontrado: boolean
  data?: LojaLogin
}

export type LojaLoginCriarResponse = {
  ok: true
  criado: boolean
  data: LojaLogin
}

export type LojaLoginCompletarResponse = {
  ok: true
  data: LojaLogin
}

export type LojaPedidoPix = {
  payload: string
  qrCodeBase64: string | null
  expiraEm: string | null
}

export type LojaPedidoPublico = {
  id: number
  status: 'aguardando' | 'pago' | 'expirado'
  forma: 'pix' | 'credito_online'
  valor: number
  pix: LojaPedidoPix | null
  checkoutUrl: string | null
}

export type LojaPedidoItemInput = {
  produto_id: number
  nome: string
  quantidade: number
  preco_unitario: number
  observacao?: string
}

export type LojaPedidoCreateResponse = {
  ok: true
  data: LojaPedidoPublico
}

export type LojaPedidoGetResponse = {
  ok: true
  data: LojaPedidoPublico
}
