import { dark, light } from './app/theme/colors.js'

/** Status aninhados a partir da paleta light (hex). */
function statusFrom(palette) {
  return {
    success: {
      DEFAULT: palette.success,
      container: palette['success-container'],
      on: palette['on-success'],
      'on-container': palette['on-success-container'],
    },
    danger: {
      DEFAULT: palette.danger,
      container: palette['danger-container'],
      on: palette['on-danger'],
      'on-container': palette['on-danger-container'],
    },
    warning: {
      DEFAULT: palette.warning,
      container: palette['warning-container'],
      on: palette['on-warning'],
      'on-container': palette['on-warning-container'],
    },
    info: {
      DEFAULT: palette.info,
      container: palette['info-container'],
      on: palette['on-info'],
      'on-container': palette['on-info-container'],
    },
  }
}

/**
 * Tokens light em hex fixo + aliases dark-* para `dark:bg-dark-*`.
 * (CSS vars em theme.css continuam para color-scheme; o toggle usa classe .dark.)
 */
const lightFlat = Object.fromEntries(
  Object.entries(light).filter(
    ([k]) =>
      !/^(success|danger|warning|info)(-|$)/.test(k) &&
      !/^(on-success|on-danger|on-warning|on-info)/.test(k),
  ),
)

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './plugins/**/*.{js,ts}',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        ...lightFlat,
        ...statusFrom(light),

        'dark-background': dark.background,
        'dark-surface': dark.surface,
        'dark-surface-dim': dark['surface-dim'],
        'dark-surface-bright': dark['surface-bright'],
        'dark-on-surface': dark['on-surface'],
        'dark-on-background': dark['on-background'],
        'dark-surface-variant': dark['surface-variant'],
        'dark-on-surface-variant': dark['on-surface-variant'],
        'dark-outline': dark.outline,
        'dark-outline-variant': dark['outline-variant'],
        'dark-primary': dark.primary,
        'dark-on-primary': dark['on-primary'],
        'dark-primary-container': dark['primary-container'],
        'dark-on-primary-container': dark['on-primary-container'],
        'dark-primary-fixed': dark['primary-fixed'],
        'dark-on-primary-fixed': dark['on-primary-fixed'],
        'dark-inverse-primary': dark['inverse-primary'],
        'dark-secondary': dark.secondary,
        'dark-on-secondary': dark['on-secondary'],
        'dark-secondary-container': dark['secondary-container'],
        'dark-on-secondary-container': dark['on-secondary-container'],
        'dark-secondary-fixed': dark['secondary-fixed'],
        'dark-on-secondary-fixed': dark['on-secondary-fixed'],
        'dark-tertiary': dark.tertiary,
        'dark-on-tertiary': dark['on-tertiary'],
        'dark-tertiary-container': dark['tertiary-container'],
        'dark-on-tertiary-container': dark['on-tertiary-container'],
        'dark-error': dark.error,
        'dark-on-error': dark['on-error'],
        'dark-error-container': dark['error-container'],
        'dark-on-error-container': dark['on-error-container'],
        'dark-inverse-surface': dark['inverse-surface'],
        'dark-inverse-on-surface': dark['inverse-on-surface'],
        'dark-surface-container-lowest': dark['surface-container-lowest'],
        'dark-surface-container-low': dark['surface-container-low'],
        'dark-surface-container': dark['surface-container'],
        'dark-surface-container-high': dark['surface-container-high'],
        'dark-surface-container-highest': dark['surface-container-highest'],
        'dark-surface-tint': dark['surface-tint'],

        'dark-success': dark.success,
        'dark-success-container': dark['success-container'],
        'dark-on-success': dark['on-success'],
        'dark-on-success-container': dark['on-success-container'],
        'dark-danger': dark.danger,
        'dark-danger-container': dark['danger-container'],
        'dark-on-danger': dark['on-danger'],
        'dark-on-danger-container': dark['on-danger-container'],
        'dark-warning': dark.warning,
        'dark-warning-container': dark['warning-container'],
        'dark-on-warning': dark['on-warning'],
        'dark-on-warning-container': dark['on-warning-container'],
        'dark-info': dark.info,
        'dark-info-container': dark['info-container'],
        'dark-on-info': dark['on-info'],
        'dark-on-info-container': dark['on-info-container'],
      },
      fontFamily: {
        headline: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        label: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      spacing: {
        px: '1px',
        0: '0',
        0.5: '2px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
        32: '128px',
        sidebar: '320px',
        header: '56px',
      },
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
        bubble: '1.25rem',
      },
      fontSize: {
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        md: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['22px', { lineHeight: '32px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['36px', { lineHeight: '44px' }],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.08)',
        DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.1)',
        md: '0 4px 16px rgba(0, 0, 0, 0.12)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.16)',
        panel: '2px 0 8px rgba(0, 0, 0, 0.08)',
        glow: '0 0 24px rgba(55, 187, 74, 0.25)',
        'glow-dark': '0 0 28px rgba(141, 217, 148, 0.2)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2.5s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
