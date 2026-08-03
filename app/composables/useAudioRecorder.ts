import { onBeforeUnmount, ref } from 'vue'
import { toast } from 'vue-sonner'

/**
 * Gravação de áudio via MediaRecorder (mic).
 * Usado no chat e nas anotações internas.
 */
export function useAudioRecorder() {
  const isRecording = ref(false)
  const isPaused = ref(false)
  const recordSeconds = ref(0)

  let recordTimer: ReturnType<typeof setInterval> | null = null
  let recorder: MediaRecorder | null = null
  let recordChunks: BlobPart[] = []
  let recordMime: string | null = null
  let mediaStream: MediaStream | null = null

  function clearRecordTimer() {
    if (recordTimer) clearInterval(recordTimer)
    recordTimer = null
  }

  function stopStream() {
    mediaStream?.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }

  function formatRecordTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function startRecording(): Promise<boolean> {
    if (isRecording.value) return false

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      toast.error('Permita o microfone para gravar áudio.')
      return false
    }

    recordChunks = []
    recordSeconds.value = 0
    isPaused.value = false
    mediaStream = stream

    try {
      recorder = new MediaRecorder(stream)
    } catch {
      stopStream()
      toast.error('Seu navegador não suporta gravação de áudio.')
      return false
    }

    recordMime = recorder.mimeType || null
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recordChunks.push(ev.data)
    }
    recorder.onstop = () => {
      stopStream()
    }

    recorder.start()
    isRecording.value = true
    clearRecordTimer()
    recordTimer = setInterval(() => {
      recordSeconds.value += 1
    }, 1000)
    return true
  }

  function togglePauseRecording() {
    if (!recorder || !isRecording.value) return
    if (recorder.state === 'recording') {
      recorder.pause()
      isPaused.value = true
      clearRecordTimer()
      return
    }
    if (recorder.state === 'paused') {
      recorder.resume()
      isPaused.value = false
      clearRecordTimer()
      recordTimer = setInterval(() => {
        recordSeconds.value += 1
      }, 1000)
    }
  }

  /** Cancela a gravação sem gerar arquivo. */
  function cancelRecording() {
    clearRecordTimer()
    const r = recorder
    recorder = null
    isRecording.value = false
    isPaused.value = false
    recordSeconds.value = 0
    recordChunks = []
    recordMime = null
    try {
      if (r && r.state !== 'inactive') r.stop()
    } catch {
      /* ignore */
    }
    stopStream()
  }

  /**
   * Encerra a gravação e devolve Blob + File.
   * Retorna `null` se o áudio estiver vazio.
   */
  async function stopAndGetAudio(): Promise<{ blob: Blob; file: File; mime: string } | null> {
    if (!recorder || !isRecording.value) return null

    const r = recorder
    const mime = recordMime || 'audio/webm'

    clearRecordTimer()
    isRecording.value = false
    isPaused.value = false
    recorder = null

    try {
      r.requestData?.()
    } catch {
      /* ignore */
    }
    try {
      r.stop()
    } catch {
      /* ignore */
    }

    await new Promise((resolve) => setTimeout(resolve, 50))

    const blob = new Blob(recordChunks, { type: mime })
    recordChunks = []
    recordMime = null
    recordSeconds.value = 0

    if (blob.size === 0) {
      toast.error('Áudio vazio.')
      return null
    }

    const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm'
    const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mime })
    return { blob, file, mime }
  }

  onBeforeUnmount(() => {
    cancelRecording()
  })

  return {
    isRecording,
    isPaused,
    recordSeconds,
    formatRecordTime,
    startRecording,
    togglePauseRecording,
    cancelRecording,
    stopAndGetAudio,
  }
}
