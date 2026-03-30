import { onMounted } from 'vue'

const STORAGE_KEY = 'multi-atendimento-color-mode'

export function useColorMode() {
  const isDark = useState<boolean>('color-mode-dark', () => false)

  function apply() {
    if (!process.client) return
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function setDark(value: boolean) {
    isDark.value = value
    apply()
    if (process.client) localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light')
  }

  function toggle() {
    setDark(!isDark.value)
  }

  onMounted(() => {
    if (!process.client) return

    const stored = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null
    if (stored === 'dark') isDark.value = true
    else if (stored === 'light') isDark.value = false
    else isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches

    apply()
  })

  return { isDark, toggle, setDark }
}
