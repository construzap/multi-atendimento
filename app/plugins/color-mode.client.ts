import { COLOR_MODE_STORAGE_KEY } from '~/theme/colors.js'

/** Aplica `html.dark` cedo no client, alinhado ao storage. */
export default defineNuxtPlugin(() => {
  const isDark = useState<boolean>('color-mode-dark', () => false)

  let dark = false
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY) as 'dark' | 'light' | null
    if (stored === 'dark') dark = true
    else if (stored === 'light') dark = false
    else dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    dark = false
  }

  isDark.value = dark

  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'only dark' : 'only light'
  root.style.backgroundColor = dark ? '#111414' : '#ffffff'
})
