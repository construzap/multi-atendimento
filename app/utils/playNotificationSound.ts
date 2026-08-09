/**
 * Toca um bip de notificação no navegador (Web Audio API).
 * Pode ser bloqueado pelo autoplay até haver interação do usuário na página.
 */
export function playNotificationSound(options?: { forte?: boolean }): void {
  if (!import.meta.client) return
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const forte = options?.forte === true
    const now = ctx.currentTime
    const volume = forte ? 0.32 : 0.18
    const notes = forte
      ? [
          { f: 784, t: 0 },
          { f: 988, t: 0.12 },
          { f: 1175, t: 0.24 },
          { f: 1319, t: 0.4 },
        ]
      : [
          { f: 880, t: 0 },
          { f: 1174.7, t: 0.09 },
        ]
    const end = forte ? 0.75 : 0.4

    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, now)

    for (const n of notes) {
      const osc = ctx.createOscillator()
      osc.type = forte ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(n.f, now + n.t)
      osc.connect(gain)
      osc.start(now + n.t)
      osc.stop(now + end)
    }

    gain.gain.exponentialRampToValueAtTime(volume, now + 0.03)
    if (forte) {
      gain.gain.exponentialRampToValueAtTime(volume * 0.85, now + 0.35)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + end)
    } else {
      gain.gain.exponentialRampToValueAtTime(0.0001, now + end)
    }

    window.setTimeout(() => {
      void ctx.close()
    }, Math.ceil(end * 1000) + 80)
  } catch {
    // Autoplay bloqueado ou AudioContext indisponível — silencioso.
  }
}
