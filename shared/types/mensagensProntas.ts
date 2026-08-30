export type MensagemProntaTipo =
  | 'texto'
  | 'audio'
  | 'imagem'
  | 'video'
  | 'documento'
  | 'figurinha'
  | 'ligacao'

/** Limites do tempo que a ligação toca (passo `ligacao`). */
export const DURACAO_LIGACAO_SEGUNDOS_MIN = 1
export const DURACAO_LIGACAO_SEGUNDOS_MAX = 60
export const DURACAO_LIGACAO_SEGUNDOS_DEFAULT = 15

/** Placeholder em `conteudo` (coluna NOT NULL) quando o passo é ligação. */
export const CONTEUDO_PASSO_LIGACAO = 'ligacao'

export type MensagemProntaPassoInput = {
  ordem: number
  tipo: MensagemProntaTipo
  conteudo: string
  delay_segundos: number
  /** Só preenchido quando `tipo === 'ligacao'`. */
  duracao_ligacao_segundos?: number | null
}

export type MensagemProntaSequenciaResumo = {
  id: string
  nome: string
  workspace_id: number
  user_id: string
  created_at: string
  /**
   * Coluna do kanban para mover o contato após enviar todos os passos.
   * `null` = não movimentar.
   */
  coluna_destino_id: number | null
  /** Se a I.A. deve ficar ligada após o envio da sequência. Default `true`. */
  ia_ligada: boolean
  /** Se deve fechar pedidos da I.A. em aberto após o envio. Default `false`. */
  fechar_pedido_em_aberto: boolean
}

export type MensagemProntaPasso = {
  id: string
  sequencia_id: string
  ordem: number
  tipo: MensagemProntaTipo
  conteudo: string
  delay_segundos: number
  /** Segundos que a ligação toca. `null` nos demais tipos. */
  duracao_ligacao_segundos: number | null
  created_at: string
}

/** Item da lista no dropdown (mock ou API). */
export type MensagemProntaListaItem = {
  id: string
  titulo: string
  /** Preview / primeiro passo texto. */
  texto: string
}

export type CriarMensagemProntaBody = {
  workspace_id: number
  nome: string
  passos: MensagemProntaPassoInput[]
  coluna_destino_id?: number | null
  ia_ligada?: boolean
  fechar_pedido_em_aberto?: boolean
}

export type CriarMensagemProntaResponse = {
  ok: true
  sequencia: MensagemProntaSequenciaResumo
  passos: MensagemProntaPasso[]
}

/** Sequência com passos (lista / cache Pinia). */
export type MensagemProntaComPassos = {
  sequencia: MensagemProntaSequenciaResumo
  passos: MensagemProntaPasso[]
}

export type ListarMensagensProntasResponse = {
  ok: true
  items: MensagemProntaComPassos[]
}

/** Body do POST /api/mensagens_prontas/webhookN8nPost */
export type WebhookN8nMensagemProntaBody = {
  workspace_id: number
  canal_id: number
  conversa_key: string
  phone: string | null
  name: string | null
  mensagem_pronta: MensagemProntaComPassos
  /**
   * Após os passos: mover contato para esta coluna do kanban.
   * `null` quando a sequência não define destino.
   */
  coluna_destino_id: number | null
  /** Espelha se haverá movimentação (`coluna_destino_id != null`). */
  mover_contato: boolean
  /** Espelha `mensagem_pronta.sequencia.ia_ligada`. */
  ia_ligada: boolean
  /** Espelha `mensagem_pronta.sequencia.fechar_pedido_em_aberto`. */
  fechar_pedido_em_aberto: boolean
}

export type WebhookN8nMensagemProntaResponse = {
  ok: true
}

export type AtualizarMensagemProntaBody = {
  workspace_id: number
  nome: string
  passos: MensagemProntaPassoInput[]
  coluna_destino_id?: number | null
  ia_ligada?: boolean
  fechar_pedido_em_aberto?: boolean
}

export type AtualizarMensagemProntaResponse = {
  ok: true
  sequencia: MensagemProntaSequenciaResumo
  passos: MensagemProntaPasso[]
}

export type ExcluirMensagemProntaResponse = {
  ok: true
  id: string
}
