/**
 * Sino de “pedido novo” — toca em loop alto até `pararSomNavegadorPedidoNovo()`.
 * Arquivo: `public/sounds/sino-pedido-novo.mp3`
 */

const AUDIO_SRC = '/sounds/sino-pedido-novo.mp3'
const VOLUME = 1

let audioEl: HTMLAudioElement | null = null

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

/** Inicia (ou reinicia) o sino em loop. */
export function SomNavegadorPedidoNovo(): void {
  if (!import.meta.client) return
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
