const elements = new Map<HTMLElement, () => void>()

document.addEventListener('click', (e) => {
  const items = [...elements.entries()]
  const done = items.filter(([el]) => !el.contains(e.target as Node))

  done.forEach(([el, callback]) => {
    elements.delete(el)
    callback()
  })
})

export default (element: HTMLElement, callback: () => void) =>
  elements.set(element, callback)
