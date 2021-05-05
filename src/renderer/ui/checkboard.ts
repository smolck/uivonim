const checkboardCache = new Map<string, any>()

const render = (color1: string, color2: string, size: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = color1
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = color2
  ctx.fillRect(0, 0, size, size)
  ctx.translate(size, size)
  ctx.fillRect(0, 0, size, size)
  return canvas.toDataURL()
}

export default (color1: string, color2: string, size: number) => {
  const scaledSize = size * window.devicePixelRatio
  const key = `${color1}-${color2}-${scaledSize}`
  if (checkboardCache.has(key)) return checkboardCache.get(key)

  const checkboard = render(color1, color2, scaledSize)
  checkboardCache.set(key, checkboard)
  return checkboard
}
