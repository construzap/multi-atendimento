export type MensagemProntaTipo = 'texto' | 'audio' | 'imagem' | 'video' | 'documento'

export type MensagemProntaPassoInput = {
  ordem: number
  tipo: MensagemProntaTipo
  conteudo: string
  delay_segundos: number
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
}

export type MensagemProntaPasso = {
  id: string
  sequencia_id: string
  ordem: number
  tipo: MensagemProntaTipo
  conteudo: string
  delay_segundos: number
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
}

export type WebhookN8nMensagemProntaResponse = {
  ok: true
}

export type AtualizarMensagemProntaBody = {
  workspace_id: number
  nome: string
  passos: MensagemProntaPassoInput[]
  coluna_destino_id?: number | null
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
