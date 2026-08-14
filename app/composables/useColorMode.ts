/**
 * Color mode — singleton via useState('color-mode-dark').
 * Alterna a classe `html.dark` (Tailwind darkMode: 'class').
 */
import { watch } from 'vue'
import { COLOR_MODE_STORAGE_KEY } from '~/theme/colors.js'

export const PAGE_BG_LIGHT = '#ffffff'
export const PAGE_BG_DARK = '#111414'

function readStoredIsDark(): boolean {
  if (!import.meta.client) return false
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY) as 'dark' | 'light' | null
    if (stored === 'dark') return true
    if (stored === 'light') return false
  } catch {
    /* private mode */
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function applyToDom(isDark: boolean) {
  if (!import.meta.client) return
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.dataset.theme = isDark ? 'dark' : 'light'
  // `only` tenta impedir Force Dark do Chrome/Opera de inverter o tema do app
  root.style.colorScheme = isDark ? 'only dark' : 'only light'
  root.style.backgroundColor = isDark ? PAGE_BG_DARK : PAGE_BG_LIGHT
}

let watchInstalled = false

export function useColorMode() {
  const isDark = useState<boolean>('color-mode-dark', () => false)

  const pageBg = computed(() => (isDark.value ? PAGE_BG_DARK : PAGE_BG_LIGHT))

  function setDark(value: boolean) {
    isDark.value = value
    applyToDom(value)
    if (import.meta.client) {
      try {
        localStorage.setItem(COLOR_MODE_STORAGE_KEY, value ? 'dark' : 'light')
      } catch {
        /* private mode */
      }
    }
  }

  function toggle() {
    setDark(!isDark.value)
  }

  if (import.meta.client && !watchInstalled) {
    watchInstalled = true
    const initial = readStoredIsDark()
    isDark.value = initial
    applyToDom(initial)
    watch(isDark, (v) => applyToDom(v), { flush: 'sync' })
  }

  return { isDark, pageBg, toggle, setDark }
}
