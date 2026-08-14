/** Pre-paint: html.dark + bloqueio de Force Dark do navegador. */
(function () {
  try {
    var k = 'multi-atendimento-color-mode'
    var s = localStorage.getItem(k)
    var dark =
      s === 'dark' ||
      (s !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    var root = document.documentElement
    root.classList.toggle('dark', dark)
    root.dataset.theme = dark ? 'dark' : 'light'
    root.style.colorScheme = dark ? 'only dark' : 'only light'
    root.style.backgroundColor = dark ? '#111414' : '#ffffff'
  } catch (e) {}
})()
