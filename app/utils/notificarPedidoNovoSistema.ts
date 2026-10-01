/**
 * Pedido novo com a aba em segundo plano ou a janela minimizada.
 * O MP3 do sino não toca nesse estado (o navegador bloqueia).
 * Aqui: toast do sistema (som do Windows, uma vez) + título da aba piscando.
 * Ao voltar para a aba (ou clicar no toast), o caller abre o modal e liga o sino.
 */

import { somPedidoAtivo } from '~/utils/SomNavegadorPedidoNovo'

let notificacaoAtiva: Notification | null = null
let tituloOriginal: string | null = null
let piscaTimer: ReturnType<typeof setInterval> | null = null
let onVisivel: (() => void) | null = null

function notificacaoDisponivel(): boolean {
  return import.meta.client && typeof Notification !== 'undefined'
}

function piscarTituloAba(mensagem: string) {
  if (!import.meta.client) return
  pararPiscarTituloAba()
  tituloOriginal = document.title
  let ligado = false
  const tick = () => {
    ligado = !ligado
    document.title = ligado ? mensagem : (tituloOriginal ?? document.title)
  }
  tick()
  piscaTimer = setInterval(tick, 1000)
}

function pararPiscarTituloAba() {
  if (piscaTimer != null) {
    clearInterval(piscaTimer)
    piscaTimer = null
  }
  if (tituloOriginal != null && import.meta.client) {
    document.title = tituloOriginal
    tituloOriginal = null
  }
}

function fecharNotificacaoSistema() {
  try {
    notificacaoAtiva?.close()
  } catch {
    /* ignore */
  }
  notificacaoAtiva = null
}

/** Encerra toast e pisca-pisca sem abrir o modal. */
export function cancelarAlertaPedidoForaDaAba(): void {
  if (onVisivel) {
    document.removeEventListener('visibilitychange', onVisivel)
    onVisivel = null
  }
  fecharNotificacaoSistema()
  pararPiscarTituloAba()
}

/**
 * Aba oculta ou janela minimizada: notificação do sistema + título piscando.
 * `aoVoltar` roda no clique do toast ou quando a aba volta a ficar visível.
 */
export function alertarPedidoForaDaAba(input: {
  titulo: string
  texto: string
  aoVoltar: () => void
}): void {
  if (!import.meta.client) return

  cancelarAlertaPedidoForaDaAba()

  let disparou = false
  const voltar = () => {
    if (disparou) return
    disparou = true
    cancelarAlertaPedidoForaDaAba()
    try {
      window.focus()
    } catch {
      /* ignore */
    }
    input.aoVoltar()
  }

  onVisivel = () => {
    if (document.visibilityState === 'visible') voltar()
  }
  document.addEventListener('visibilitychange', onVisivel)

  piscarTituloAba(`Pedido novo!`)

  if (!somPedidoAtivo.value || !notificacaoDisponivel() || Notification.permission !== 'granted') return

  try {
    const n = new Notification(input.titulo, {
      body: input.texto,
      lang: 'pt-BR',
      tag: 'pedido-novo',
      renotify: true,
    } as NotificationOptions)
    notificacaoAtiva = n
    n.onclick = () => voltar()
    n.onclose = () => {
      if (notificacaoAtiva === n) notificacaoAtiva = null
    }
  } catch {
    /* sem permissão ou API indisponível: o título da aba continua piscando */
  }
}
