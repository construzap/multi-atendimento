import { watch } from 'vue'
import Pusher from 'pusher-js'
import { toast } from 'vue-sonner'
import type { PusherKanbanAtualizacaoPayload } from '#shared/types/kanban'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { abrirConversaNoChat } from '~/composables/useConversasRouteSync'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useKanbanStore } from '~/stores/kanban'
import { useKanbanPusherAlertaStore } from '~/stores/kanbanPusherAlerta'
import { useMensagensStore } from '~/stores/mensagens'
import { useWorkspacesStore } from '~/stores/workspaces'
import { isPedidoPronto } from '~/components/kanban/notificacoes_ia/parseProdutosNotificacao'

/** Inscreve em `String(id_canal)` conforme `canais.items` + canais dos cards do kanban. */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const appKey = typeof config.public.pusherKey === 'string' ? config.public.pusherKey.trim() : ''
  const cluster =
    typeof config.public.pusherCluster === 'string' ? config.public.pusherCluster.trim() : ''
  if (!appKey || !cluster) return

  let client: Pusher | null = null
  const subscribedIds = new Set<number>()

  function getClient(): Pusher {
    if (!client) {
      client = new Pusher(appKey, { cluster })
    }
    return client
  }

  const canais = useCanaisStore()
  const conversas = useConversasStore()
  const kanban = useKanbanStore()
  const workspaces = useWorkspacesStore()
  const kanbanAlerta = useKanbanPusherAlertaStore()

  function canalIdsParaInscrever(): number[] {
    const ids = new Set<number>()
    for (const c of canais.items) {
      if (c.id >= 1) ids.add(c.id)
    }
    for (const col of kanban.columns) {
      for (const card of col.cards) {
        if (card.id_canal != null && card.id_canal >= 1) ids.add(card.id_canal)
      }
    }
    const infoCanal = kanban.infoContatoIdCanal
    if (infoCanal != null && infoCanal >= 1) ids.add(infoCanal)
    return [...ids].sort((a, b) => a - b)
  }

  function nomeCanal(canalId: number): string {
    const found = canais.items.find((c) => c.id === canalId)
    const nome = found?.nome?.trim()
    return nome || `Canal ${canalId}`
  }

  function notificarMensagemOutroCanal(canalId: number, data: PusherNovaMensagemPayload) {
    if (data.mensagem.from_me === true) return
    if (canais.currentCanalId === canalId) return

    const conversaKey = data.conversa_key?.trim()
    if (!conversaKey) return

    const preview = (data.mensagem.message ?? data.mensagem.caption ?? '').trim()
    const contato =
      data.conversa_name?.trim() ||
      data.name_group?.trim() ||
      data.mensagem.name?.trim() ||
      data.mensagem.phone?.trim() ||
      'Contato'

    const trecho = preview
      ? preview.length > 80
        ? `${preview.slice(0, 80)}…`
        : preview
      : 'Nova mensagem'

    const toastId = toast.info(`${nomeCanal(canalId)} · ${contato}`, {
      description: trecho,
      duration: 8000,
      action: {
        label: 'Abrir',
        onClick: () => {
          const wsId = workspaces.currentWorkspaceId
          if (!wsId) return
          void abrirConversaNoChat(wsId, canalId, conversaKey, { replace: false })
          toast.dismiss(toastId)
        },
      },
    })
  }

  function notificarKanbanAtualizacao(data: PusherKanbanAtualizacaoPayload) {
    const wsAtual = workspaces.currentWorkspaceId
    if (!wsAtual || String(wsAtual) !== String(data.workspace_id)) return

    const conversaKey = data.conversa_key?.trim()
    if (!conversaKey) return

    kanban.mergeFromPusherKanbanAtualizacao(data)
    conversas.mergeFromPusherKanbanAtualizacao(data)

    // Sync só Pinia (N8N) — sem som / modal de pedido novo.
    if (data.motivo === 'pinia_sync') return

    // Som + alerta só para pedido_pronto (não toca em mudança de coluna).
    if (!data.notificacao || !isPedidoPronto(data.notificacao.tipo_solicitacao)) return

    const contato = data.nome_contato?.trim() || 'Contato'
    kanbanAlerta.showPedidoNovo(contato, conversaKey)
  }

  watch(
    () => canalIdsParaInscrever().join(','),
    () => {
      const p = getClient()
      const want = new Set(canalIdsParaInscrever())

      for (const id of subscribedIds) {
        if (!want.has(id)) {
          p.unsubscribe(String(id))
          subscribedIds.delete(id)
        }
      }

      for (const id of want) {
        if (subscribedIds.has(id)) continue
        const channel = p.subscribe(String(id))
        channel.bind('nova-mensagem', (data: PusherNovaMensagemPayload) => {
          useConversasStore().mergeFromPusherNovaMensagem(id, data)
          useMensagensStore().mergeFromPusherNovaMensagem(id, data)
          useKanbanStore().mergeFromPusherNovaMensagem(id, data)
          notificarMensagemOutroCanal(id, data)
        })
        channel.bind('kanban-atualizacao', (data: PusherKanbanAtualizacaoPayload) => {
          notificarKanbanAtualizacao(data)
        })
        subscribedIds.add(id)
      }
    },
    { immediate: true },
  )
})
