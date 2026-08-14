/**
 * Fonte única da paleta light/dark (Material You).
 * Consumida por tailwind.config.js e pelo CSS de tema do app.
 */

/** @type {Record<string, string>} */
export const light = {
  'on-secondary-fixed-variant': '#315038',
  'on-primary-fixed-variant': '#065b1e',
  background: '#ffffff',
  'surface-tint': '#1a7b2d',
  'on-secondary-container': '#072010',
  'surface-container-high': '#e8e8e8',
  tertiary: '#00639a',
  'secondary-container': '#caeecf',
  'on-surface': '#1a1c1c',
  'surface-dim': '#dadada',
  'on-tertiary-fixed': '#001d32',
  'error-container': '#ffdad6',
  'secondary-fixed': '#caeecf',
  'on-tertiary': '#ffffff',
  secondary: '#4a6850',
  'primary-fixed-dim': '#8dd994',
  'surface-bright': '#ffffff',
  'on-error': '#ffffff',
  primary: '#1a7b2d',
  error: '#ba1a1a',
  'on-error-container': '#93000a',
  'on-background': '#1a1c1c',
  'inverse-surface': '#2f3131',
  'primary-fixed': '#b4f0bc',
  'secondary-fixed-dim': '#aed2b4',
  'on-primary-fixed': '#002108',
  'inverse-primary': '#8dd994',
  'tertiary-fixed': '#cee5ff',
  'on-secondary-fixed': '#072010',
  'inverse-on-surface': '#f1f1f1',
  'on-primary': '#ffffff',
  'surface-variant': '#e2e2e2',
  'surface-container-low': '#f7f7f7',
  'surface-container': '#f0f0f0',
  'outline-variant': '#b9d9bc',
  'tertiary-fixed-dim': '#96ccff',
  'primary-container': '#a8f5b0',
  'surface-container-highest': '#e2e2e2',
  'surface-container-lowest': '#ffffff',
  'on-tertiary-container': '#003454',
  'on-tertiary-fixed-variant': '#004a76',
  'on-secondary': '#ffffff',
  surface: '#ffffff',
  'on-primary-container': '#002108',
  'tertiary-container': '#00a0f6',
  'on-surface-variant': '#405743',
  outline: '#5a7a5d',

  'secondary-accent': '#315038',
  'secondary-muted': '#587963',
  'tertiary-accent': '#0088d4',
  'tertiary-muted': '#5a9bc4',

  'primary-50': '#f0fdf4',
  'primary-100': '#d0f5d5',
  'primary-400': '#37bb4a',
  'primary-500': '#1a7b2d',
  'primary-600': '#065b1e',
  'primary-700': '#003d14',

  success: '#2e7d32',
  'success-container': '#c8e6c9',
  'on-success': '#ffffff',
  'on-success-container': '#002105',
  danger: '#ba1a1a',
  'danger-container': '#ffdad6',
  'on-danger': '#ffffff',
  'on-danger-container': '#93000a',
  warning: '#e65100',
  'warning-container': '#ffe0b2',
  'on-warning': '#ffffff',
  'on-warning-container': '#3e2723',
  info: '#00639a',
  'info-container': '#cee5ff',
  'on-info': '#ffffff',
  'on-info-container': '#003454',
}

/** @type {Record<string, string>} */
export const dark = {
  background: '#111414',
  surface: '#111414',
  'surface-dim': '#0c0f0f',
  'surface-bright': '#1a1d1d',
  'on-surface': '#e2e4e4',
  'on-background': '#e2e4e4',
  'surface-variant': '#2d3e2e',
  'on-surface-variant': '#b8d4bc',
  outline: '#7a9b7e',
  'outline-variant': '#3b5441',
  primary: '#8dd994',
  'on-primary': '#003916',
  'primary-container': '#065b1e',
  'on-primary-container': '#b4f0bc',
  'primary-fixed': '#b4f0bc',
  'on-primary-fixed': '#002108',
  'inverse-primary': '#1a7b2d',
  secondary: '#aed2b4',
  'on-secondary': '#1c3521',
  'secondary-container': '#315038',
  'on-secondary-container': '#caeecf',
  'secondary-fixed': '#caeecf',
  'on-secondary-fixed': '#072010',
  tertiary: '#96ccff',
  'on-tertiary': '#003454',
  'tertiary-container': '#004a76',
  'on-tertiary-container': '#cee5ff',
  error: '#ffb4ab',
  'on-error': '#690005',
  'error-container': '#93000a',
  'on-error-container': '#ffdad6',
  'inverse-surface': '#e2e4e4',
  'inverse-on-surface': '#2f3131',
  'surface-container-lowest': '#0c0f0f',
  'surface-container-low': '#1a1d1d',
  'surface-container': '#1e2121',
  'surface-container-high': '#282b2b',
  'surface-container-highest': '#333636',
  'surface-tint': '#8dd994',

  success: '#81c784',
  'success-container': '#1b5e20',
  'on-success': '#003300',
  'on-success-container': '#c8e6c9',
  danger: '#ffb4ab',
  'danger-container': '#93000a',
  'on-danger': '#690005',
  'on-danger-container': '#ffdad6',
  warning: '#ffb74d',
  'warning-container': '#e65100',
  'on-warning': '#3e2723',
  'on-warning-container': '#ffe0b2',
  info: '#96ccff',
  'info-container': '#004a76',
  'on-info': '#003454',
  'on-info-container': '#cee5ff',

  // Escala primary / acentos no dark (fallback estável)
  'on-secondary-fixed-variant': '#aed2b4',
  'on-primary-fixed-variant': '#8dd994',
  'on-tertiary-fixed': '#cee5ff',
  'on-tertiary-fixed-variant': '#96ccff',
  'secondary-fixed-dim': '#aed2b4',
  'primary-fixed-dim': '#8dd994',
  'tertiary-fixed': '#cee5ff',
  'tertiary-fixed-dim': '#96ccff',
  'secondary-accent': '#aed2b4',
  'secondary-muted': '#7a9b7e',
  'tertiary-accent': '#96ccff',
  'tertiary-muted': '#5a9bc4',
  'primary-50': '#0c1f12',
  'primary-100': '#12301a',
  'primary-400': '#8dd994',
  'primary-500': '#8dd994',
  'primary-600': '#a8f5b0',
  'primary-700': '#b4f0bc',
}

/** Chave do localStorage usada pelo color mode */
export const COLOR_MODE_STORAGE_KEY = 'multi-atendimento-color-mode'

/**
 * Hex (#rgb / #rrggbb) → "R G B" para CSS `rgb(var(--x) / <alpha>)`.
 * @param {string} hex
 * @returns {string}
 */
export function hexToRgbChannels(hex) {
  const raw = String(hex ?? '').replace('#', '').trim()
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    return `${r} ${g} ${b}`
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16)
    const g = parseInt(raw.slice(2, 4), 16)
    const b = parseInt(raw.slice(4, 6), 16)
    return `${r} ${g} ${b}`
  }
  return '0 0 0'
}

/**
 * @param {Record<string, string>} palette
 * @returns {Record<string, string>}
 */
export function paletteToCssVars(palette) {
  /** @type {Record<string, string>} */
  const vars = {}
  for (const [key, value] of Object.entries(palette)) {
    vars[`--color-${key}`] = hexToRgbChannels(value)
  }
  return vars
}

/**
 * Tokens semânticos do Tailwind apontando para CSS variables (com alpha).
 * @param {string[]} keys
 * @returns {Record<string, string>}
 */
export function semanticColorVars(keys) {
  /** @type {Record<string, string>} */
  const colors = {}
  for (const key of keys) {
    colors[key] = `rgb(var(--color-${key}) / <alpha-value>)`
  }
  return colors
}

/** Chaves que trocam automaticamente com `.dark` via CSS variables */
export const SEMANTIC_COLOR_KEYS = [
  ...new Set([...Object.keys(light), ...Object.keys(dark)]),
]
