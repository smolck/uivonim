export const paddingVH = (vertical: number, horizontal: number) => ({
  paddingLeft: `${vertical}px`,
  paddingRight: `${vertical}px`,
  paddingTop: `${horizontal}px`,
  paddingBottom: `${horizontal}px`,
})

export const paddingH = (amount: number) => ({
  paddingTop: `${amount}px`,
  paddingBottom: `${amount}px`,
})

export const paddingV = (amount: number) => ({
  paddingLeft: `${amount}px`,
  paddingRight: `${amount}px`,
})

export const translate = (x: number | string, y: number | string) =>
  `translate(${x}px, ${y}px)`
export const cvar = (name: string) => `var(--${name})`
export const rgba = (red: number, green: number, blue: number, alpha: number) =>
  `rgba(${red}, ${green}, ${blue}, ${alpha})`

export const setVar = (name: string, val: number | string) =>
  document.documentElement.style.setProperty(`--${name}`, val + '')

const gradient = (
  deg: number,
  color1: string,
  fade1: number,
  color2: string,
  fade2: number
) => `linear-gradient(${deg}deg, ${color1} ${fade1}%, ${color2} ${fade2}%)`

export const partialFill = (direction: string, color: string, size: number) =>
  gradient(direction === 'horizontal' ? 0 : 90, color, size, 'rgba(0,0,0,0)', 0)

export const hexToRGB = (color: string) => {
  const hex = parseInt(color.replace(/#/, ''), 16)
  return [hex >> 16, (hex >> 8) & 0xff, hex & 0xff]
}

export const hexToRGBA = (color: string, alpha: number) => {
  if (!color) return ''
  const [r, g, b] = hexToRGB(color)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const rgbToHSL = (red: number, green: number, blue: number) => {
  const r = red / 255
  const g = green / 255
  const b = blue / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  let h: number = (max + min) / 2
  let s: number = (max + min) / 2
  let l: number = (max + min) / 2

  if (max == min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

const toHex = (x: any) => {
  const hex = x.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}

export const rgbToHex = (red: number, green: number, blue: number) => {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

const bound = (n: any, max: any) => {
  n = Math.min(max, Math.max(0, parseFloat(n)))
  if (Math.abs(n - max) < 0.000001) return 1
  return (n % max) / parseFloat(max)
}

export const hsvToRGB = (hue: number, saturation: number, value: number) => {
  const h = bound(hue, 360) * 6
  const s = bound(saturation, 100)
  const v = bound(value, 100)
  const i = Math.floor(h)
  const f = h - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const mod = i % 6
  const r = Math.round([v, q, p, p, t, v][mod] * 255)
  const g = Math.round([t, v, v, q, p, p][mod] * 255)
  const b = Math.round([p, p, t, v, v, q][mod] * 255)

  return [r, g, b]
}

export const rgbToHSV = (red: number, green: number, blue: number) => {
  const r = bound(red, 255)
  const g = bound(green, 255)
  const b = bound(blue, 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  let h = max
  let s = max
  let v = max
  let d = max - min
  s = max === 0 ? 0 : d / max

  if (max == min) h = 0
  else {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)]
}

const hue2rgb = (p: number, q: number, t: number) => {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

export const hslToRGB = (
  hue: number,
  saturation: number,
  lightness: number
) => {
  const h = bound(hue, 360)
  const s = bound(saturation, 100)
  const l = bound(lightness, 100)

  if (s === 0) {
    const e = Math.round(l * 255)
    return [e, e, e]
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255)
  const g = Math.round(hue2rgb(p, q, h) * 255)
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255)

  return [r, g, b]
}

// https://stackoverflow.com/a/13542669
const shadeColor = (color: string, percent: number) => {
  const f = parseInt(color.slice(1), 16)
  const t = percent < 0 ? 0 : 255
  const p = percent < 0 ? percent * -1 : percent
  const R = f >> 16
  const G = (f >> 8) & 0x00ff
  const B = f & 0x0000ff

  return (
    '#' +
    (
      0x1000000 +
      (Math.round((t - R) * p) + R) * 0x10000 +
      (Math.round((t - G) * p) + G) * 0x100 +
      (Math.round((t - B) * p) + B)
    )
      .toString(16)
      .slice(1)
  )
}

export const contrast = (
  color: string,
  contrastAgainst: string,
  amount: number
) => {
  amount
  const [r, g, b] = hexToRGB(contrastAgainst)
  const [, , /*hue*/ /*saturation*/ lightness] = rgbToHSL(r, g, b)
  const shouldDarken = lightness < 50
  return shadeColor(color, shouldDarken ? -(amount / 100) : (amount - 10) / 100)
}

export const brighten = (color: string, amount: number) =>
  shadeColor(color, amount / 100)
export const darken = (color: string, amount: number) =>
  shadeColor(color, -(amount / 100))

// chrome does not support .finished property on animate()
export const animate = (
  element: HTMLElement,
  keyframes: Keyframe[],
  options = {} as any
): Promise<void> => {
  if (options.duration) {
    element.animate(keyframes, options)
    return new Promise((fin) => setTimeout(fin, options.duration - 25))
  }

  element.animate(keyframes, options)
  return Promise.resolve()
}
