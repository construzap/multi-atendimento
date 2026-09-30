/**
 * Sino de “pedido novo” — toca em loop alto até `pararSomNavegadorPedidoNovo()`.
 * Arquivo: `public/sounds/sino-pedido-novo.mp3`
 *
 * O Chrome só deixa esse MP3 tocar com outra aba na frente (YouTube etc.)
 * depois de um `play()` feito no clique do usuário. `ativarSomPedidoNovo()` faz isso.
 */

import { ref } from 'vue'

const AUDIO_SRC = '/sounds/sino-pedido-novo.mp3'
const VOLUME = 1
const STORAGE_KEY = 'kanban.som_pedido_novo'

let audioEl: HTMLAudioElement | null = null

/** `true` só depois do clique em Ativar som nesta carga da página. */
export const somPedidoLiberado = ref(false)

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
  return somPedidoLiberado.value === true
}

/**
 * Clique do usuário: toca e pausa o áudio na hora.
 * Esse gesto libera o mesmo elemento para tocar depois, mesmo com a aba em segundo plano.
 */
export async function ativarSomPedidoNovo(): Promise<boolean> {
  if (!import.meta.client) return false
  const el = garantirAudio()
  if (!el) return false

  try {
    // Tem que ser com som (não muted): o Chrome só libera o play() futuro
    // se este play() do clique realmente saiu com áudio.
    el.loop = false
    el.muted = false
    el.volume = 0.35
    el.currentTime = 0
    await el.play()
    await new Promise((resolve) => setTimeout(resolve, 160))
    el.pause()
    el.currentTime = 0
    el.loop = true
    el.volume = VOLUME
    somPedidoLiberado.value = true
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {
        /* recusou o toast; o sino ainda fica liberado */
      })
    }
    return true
  } catch {
    el.muted = false
    el.loop = true
    el.volume = VOLUME
    somPedidoLiberado.value = false
    return false
  }
}

export function desativarSomPedidoNovo(): void {
  somPedidoLiberado.value = false
  if (import.meta.client) {
    try {
      localStorage.setItem(STORAGE_KEY, '0')
    } catch {
      /* ignore */
    }
  }
  pararSomNavegadorPedidoNovo()
}

/** Inicia (ou reinicia) o sino em loop. No-op se o usuário não ativou o som. */
export function SomNavegadorPedidoNovo(): void {
  if (!import.meta.client) return
  if (!somPedidoLiberado.value) return
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
