/**
 * Sino de “pedido novo” — toca em loop alto até `pararSomNavegadorPedidoNovo()`.
 * Arquivo: `public/sounds/sino-pedido-novo.mp3`
 *
 * O Chrome só deixa esse MP3 tocar com outra aba na frente depois de um `play()`
 * feito no clique do usuário. `permitirSomENotificacoes()` faz isso junto com
 * `Notification.requestPermission()`.
 */

import { ref } from 'vue'

const AUDIO_SRC = '/sounds/sino-pedido-novo.mp3'
const VOLUME = 1
const STORAGE_KEY = 'kanban.som_pedido_novo'

let audioEl: HTMLAudioElement | null = null

/** `true` depois do clique que liberou o áudio nesta visita à página. */
export const somPedidoDesbloqueado = ref(false)

function lerSomPedidoAtivo(): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** `true` só depois que o usuário permitiu som e notificação. */
export const somPedidoAtivo = ref(lerSomPedidoAtivo())

/**
 * Abre o aviso ao entrar no Kanban, até o clique de Permitir nesta visita.
 * Quem já recusou (`'0'`) não vê o aviso de novo — usa o botão Ativar som.
 */
export function deveAbrirPedidoPermissaoSom(): boolean {
  if (!import.meta.client || somPedidoDesbloqueado.value) return false
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function garantirAudio(): HTMLAudioElement | null {
  if (!import.meta.client) return null
  if (audioEl) return audioEl

  const el = new Audio(AUDIO_SRC)
  el.loop = true
  el.preload = 'auto'
  el.volume = VOLUME
  audioEl = el
  return el
}

export function somPedidoEstaLiberado(): boolean {
  return somPedidoAtivo.value === true && somPedidoDesbloqueado.value
}

function gravarPreferencia(ativo: boolean) {
  somPedidoAtivo.value = ativo
  somPedidoDesbloqueado.value = ativo
  try {
    localStorage.setItem(STORAGE_KEY, ativo ? '1' : '0')
  } catch {
    /* ignore */
  }
}

async function soltarToqueCurto(el: HTMLAudioElement): Promise<boolean> {
  try {
    el.loop = false
    el.muted = false
    el.volume = 0.35
    el.currentTime = 0
    const playPromise = el.play()
    await playPromise
    await new Promise((resolve) => setTimeout(resolve, 160))
    el.pause()
    el.currentTime = 0
    el.loop = true
    el.volume = VOLUME
    return true
  } catch {
    el.muted = false
    el.loop = true
    el.volume = VOLUME
    return false
  }
}

/**
 * Clique do usuário: pede a notificação do navegador e libera o áudio no mesmo gesto.
 * Só fica ativo se a notificação for concedida e o `play()` passar.
 */
export async function permitirSomENotificacoes(): Promise<boolean> {
  if (!import.meta.client) return false
  const el = garantirAudio()
  if (!el) return false
  if (typeof Notification === 'undefined') {
    gravarPreferencia(false)
    return false
  }

  const toque = soltarToqueCurto(el)
  const permissao =
    Notification.permission === 'granted'
      ? Promise.resolve('granted' as NotificationPermission)
      : Notification.requestPermission().catch(() => 'denied' as NotificationPermission)

  const [somOk, perm] = await Promise.all([toque, permissao])
  if (!somOk || perm !== 'granted') {
    gravarPreferencia(false)
    pararSomNavegadorPedidoNovo()
    return false
  }

  gravarPreferencia(true)
  return true
}

export function desativarSomPedidoNovo(): void {
  gravarPreferencia(false)
  pararSomNavegadorPedidoNovo()
}

/** Inicia (ou reinicia) o sino em loop. No-op se o usuário não ativou o som. */
export function SomNavegadorPedidoNovo(): void {
  if (!import.meta.client) return
  if (!somPedidoEstaLiberado()) return
  const el = garantirAudio()
  if (!el) return

  try {
    el.pause()
    el.currentTime = 0
    el.volume = VOLUME
    el.loop = true
    void el.play().catch(() => {
      // Autoplay bloqueado até haver interação do usuário na página.
    })
  } catch {
    /* ignore */
  }
}

/** Para o sino (fechar modal / “Depois” / “Abrir Área de Pedidos”). */
export function pararSomNavegadorPedidoNovo(): void {
  if (!import.meta.client) return
  if (!audioEl) return
  try {
    audioEl.pause()
    audioEl.currentTime = 0
  } catch {
    /* ignore */
  }
}
