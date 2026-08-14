/** Posiciona painel Teleport (fixed) ancorado à célula, evitando corte no fim da tabela/viewport. */
export function calcDropdownPanelStyle(
  anchorRect: DOMRect,
  options?: { minWidth?: number; maxWidth?: number; preferredMaxHeight?: number; margin?: number },
): Record<string, string> {
  const margin = options?.margin ?? 8
  const minWidth = options?.minWidth ?? 280
  const preferredMaxH = options?.preferredMaxHeight ?? 320

  let w = Math.max(minWidth, anchorRect.width)
  if (options?.maxWidth != null) w = Math.min(options.maxWidth, w)
  const left = Math.max(margin, Math.min(anchorRect.left, window.innerWidth - w - margin))

  const spaceBelow = window.innerHeight - anchorRect.bottom - margin
  const spaceAbove = anchorRect.top - margin
  const cap = Math.min(preferredMaxH, Math.floor(window.innerHeight * 0.55))

  const fitsBelow = spaceBelow >= cap
  const openUp = !fitsBelow && spaceAbove > spaceBelow

  const available = openUp ? spaceAbove : spaceBelow
  const maxH = Math.max(120, Math.min(cap, available))

  const base = {
    position: 'fixed',
    left: `${left}px`,
    width: `${w}px`,
    maxHeight: `${maxH}px`,
    zIndex: '9999',
  }

  if (openUp) {
    return { ...base, bottom: `${window.innerHeight - anchorRect.top + margin}px` }
  }
  return { ...base, top: `${anchorRect.bottom + margin}px` }
}
