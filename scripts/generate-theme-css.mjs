/**
 * Regenera app/assets/css/theme.css a partir de app/theme/colors.js
 * Uso: node scripts/generate-theme-css.mjs
 */
import fs from 'node:fs'
import { dark, light, paletteToCssVars } from '../app/theme/colors.js'

function block(sel, palette) {
  const vars = paletteToCssVars(palette)
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`)
  return `${sel} {\n${lines.join('\n')}\n}\n`
}

const css =
  `/** Gerado a partir de app/theme/colors.js — rode: node scripts/generate-theme-css.mjs */\n` +
  `html {\n  color-scheme: light;\n}\n\n` +
  `html.dark {\n  color-scheme: dark;\n}\n\n` +
  block(':root', light) +
  '\n' +
  block('.dark', { ...light, ...dark })

fs.writeFileSync(new URL('../app/assets/css/theme.css', import.meta.url), css)
console.log('Wrote app/assets/css/theme.css')
