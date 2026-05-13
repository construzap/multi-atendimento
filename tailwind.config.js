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
        // Material You — light
        'on-secondary-fixed-variant': '#315038', //aquifoimodificadocor
        'on-primary-fixed-variant': '#065b1e', //aquifoimodificadocor
        background: '#f9f9f9',
        'surface-tint': '#1a7b2d', //aquifoimodificadocor
        'on-secondary-container': '#072010', //aquifoimodificadocor
        'surface-container-high': '#e8e8e8',
        tertiary: '#00639a',
        'secondary-container': '#caeecf', //aquifoimodificadocor
        'on-surface': '#1a1c1c',
        'surface-dim': '#dadada',
        'on-tertiary-fixed': '#001d32',
        'error-container': '#ffdad6',
        'secondary-fixed': '#caeecf', //aquifoimodificadocor
        'on-tertiary': '#ffffff',
        secondary: '#4a6850', //aquifoimodificadocor
        'primary-fixed-dim': '#8dd994', //aquifoimodificadocor
        'surface-bright': '#f9f9f9',
        'on-error': '#ffffff',
        primary: '#1a7b2d', //aquifoimodificadocor
        error: '#ba1a1a',
        'on-error-container': '#93000a',
        'on-background': '#1a1c1c',
        'inverse-surface': '#2f3131',
        'primary-fixed': '#b4f0bc', //aquifoimodificadocor
        'secondary-fixed-dim': '#aed2b4', //aquifoimodificadocor
        'on-primary-fixed': '#002108', //aquifoimodificadocor
        'inverse-primary': '#8dd994', //aquifoimodificadocor
        'tertiary-fixed': '#cee5ff',
        'on-secondary-fixed': '#072010', //aquifoimodificadocor
        'inverse-on-surface': '#f1f1f1',
        'on-primary': '#ffffff',
        'surface-variant': '#e2e2e2',
        'surface-container-low': '#f3f3f3',
        'surface-container': '#eeeeee',
        'outline-variant': '#b9d9bc', //aquifoimodificadocor
        'tertiary-fixed-dim': '#96ccff',
        'primary-container': '#a8f5b0', //aquifoimodificadocor
        'surface-container-highest': '#e2e2e2',
        'surface-container-lowest': '#ffffff',
        'on-tertiary-container': '#003454',
        'on-tertiary-fixed-variant': '#004a76',
        'on-secondary': '#ffffff',
        surface: '#f9f9f9',
        'on-primary-container': '#002108', //aquifoimodificadocor
        'tertiary-container': '#00a0f6',
        'on-surface-variant': '#405743', //aquifoimodificadocor
        outline: '#5a7a5d', //aquifoimodificadocor

        // Cores secundárias (acentos / UI)
        'secondary-accent': '#315038', //aquifoimodificadocor
        'secondary-muted': '#587963', //aquifoimodificadocor
        'tertiary-accent': '#0088d4',
        'tertiary-muted': '#5a9bc4',

        // Escala primary (utilitários primary-500, focus:ring-primary-100, etc.)
        'primary-50': '#f0fdf4', //aquifoimodificadocor
        'primary-100': '#d0f5d5', //aquifoimodificadocor
        'primary-400': '#37bb4a', //aquifoimodificadocor
        'primary-500': '#1a7b2d', //aquifoimodificadocor
        'primary-600': '#065b1e', //aquifoimodificadocor
        'primary-700': '#003d14', //aquifoimodificadocor

        // Ação / semânticas
        success: {
          DEFAULT: '#2e7d32',
          container: '#c8e6c9',
          on: '#ffffff',
          'on-container': '#002105',
        },
        danger: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
          on: '#ffffff',
          'on-container': '#93000a',
        },
        warning: {
          DEFAULT: '#e65100',
          container: '#ffe0b2',
          on: '#ffffff',
          'on-container': '#3e2723',
        },
        info: {
          DEFAULT: '#00639a',
          container: '#cee5ff',
          on: '#ffffff',
          'on-container': '#003454',
        },

        // Dark mode (use com classe .dark no root)
        'dark-background': '#111414',
        'dark-surface': '#111414',
        'dark-surface-dim': '#0c0f0f',
        'dark-surface-bright': '#1a1d1d',
        'dark-on-surface': '#e2e4e4',
        'dark-on-background': '#e2e4e4',
        'dark-surface-variant': '#2d3e2e', //aquifoimodificadocor
        'dark-on-surface-variant': '#b8d4bc', //aquifoimodificadocor
        'dark-outline': '#7a9b7e', //aquifoimodificadocor
        'dark-outline-variant': '#3b5441', //aquifoimodificadocor
        'dark-primary': '#8dd994', //aquifoimodificadocor
        'dark-on-primary': '#003916', //aquifoimodificadocor
        'dark-primary-container': '#065b1e', //aquifoimodificadocor
        'dark-on-primary-container': '#b4f0bc', //aquifoimodificadocor
        'dark-primary-fixed': '#b4f0bc', //aquifoimodificadocor
        'dark-on-primary-fixed': '#002108', //aquifoimodificadocor
        'dark-inverse-primary': '#1a7b2d', //aquifoimodificadocor
        'dark-secondary': '#aed2b4', //aquifoimodificadocor
        'dark-on-secondary': '#1c3521', //aquifoimodificadocor
        'dark-secondary-container': '#315038', //aquifoimodificadocor
        'dark-on-secondary-container': '#caeecf', //aquifoimodificadocor
        'dark-secondary-fixed': '#caeecf', //aquifoimodificadocor
        'dark-on-secondary-fixed': '#072010', //aquifoimodificadocor
        'dark-tertiary': '#96ccff',
        'dark-on-tertiary': '#003454',
        'dark-tertiary-container': '#004a76',
        'dark-on-tertiary-container': '#cee5ff',
        'dark-error': '#ffb4ab',
        'dark-on-error': '#690005',
        'dark-error-container': '#93000a',
        'dark-on-error-container': '#ffdad6',
        'dark-inverse-surface': '#e2e4e4',
        'dark-inverse-on-surface': '#2f3131',
        'dark-surface-container-lowest': '#0c0f0f',
        'dark-surface-container-low': '#1a1d1d',
        'dark-surface-container': '#1e2121',
        'dark-surface-container-high': '#282b2b',
        'dark-surface-container-highest': '#333636',
        'dark-surface-tint': '#8dd994', //aquifoimodificadocor

        'dark-success': '#81c784',
        'dark-success-container': '#1b5e20',
        'dark-on-success': '#003300',
        'dark-on-success-container': '#c8e6c9',
        'dark-danger': '#ffb4ab',
        'dark-danger-container': '#93000a',
        'dark-on-danger': '#690005',
        'dark-on-danger-container': '#ffdad6',
        'dark-warning': '#ffb74d',
        'dark-warning-container': '#e65100',
        'dark-on-warning': '#3e2723',
        'dark-on-warning-container': '#ffe0b2',
        'dark-info': '#96ccff',
        'dark-info-container': '#004a76',
        'dark-on-info': '#003454',
        'dark-on-info-container': '#cee5ff',
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
        glow: '0 0 24px rgba(55, 187, 74, 0.25)', //aquifoimodificadocor
        'glow-dark': '0 0 28px rgba(141, 217, 148, 0.2)', //aquifoimodificadocor
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
