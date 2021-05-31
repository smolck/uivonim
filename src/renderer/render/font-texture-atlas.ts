import { cell, font } from '../workspace'

export interface AtlasCharBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface AtlasChar {
  idx: number
  char: string
  isDoubleWidth: boolean
  bounds: AtlasCharBounds
}

const canvas = document.createElement('canvas')
// TODO(smolck)
const atlasWidth = 1000
const atlasHeight = 500

canvas.width = Math.floor(atlasWidth * window.devicePixelRatio)
canvas.height = Math.floor(atlasHeight * window.devicePixelRatio)

const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
const charsInAtlas = new Map<string, AtlasChar>()
const charsQueue = new Map<string, AtlasChar>()

const charsByIdx = new Map<number, AtlasChar>()
let charsIdx = 0

let nextBounds: AtlasCharBounds | undefined

// https://stackoverflow.com/a/12057594
const isEmpty = (map: Map<string, AtlasChar>) => {
  for (const _ of map) {
    return false
  }

  return true
}

const updateNextBounds = (isDoubleWidth: boolean) => {
  if (!nextBounds) throw new Error('nextBounds not defined font atlas')

  const oldBounds = nextBounds
  const moveDown = oldBounds.right + cell.width >= atlasWidth

  const paddingY = 5
  const paddingX = 2
  const charHeight = cell.height + paddingY
  const charWidth = (isDoubleWidth ? cell.width * 2 : cell.width) + paddingX

  nextBounds = moveDown
    ? {
        left: 0,
        right: charWidth,
        top: oldBounds.top + charHeight,
        bottom: oldBounds.bottom + charHeight,
      }
    : {
        left: oldBounds.left + charWidth,
        right: oldBounds.right + charWidth,
        top: oldBounds.top,
        bottom: oldBounds.bottom,
      }
}

export const getChar = (char: string, isDoubleWidth: boolean = false) => {
  const maybeChar = charsInAtlas.get(char) || charsQueue.get(char)
  if (maybeChar) return maybeChar

  // Char isn't in font atlas, so let's add it.
  const idx = charsIdx++
  let newChar
  if (nextBounds) {
    newChar = {
      char,
      isDoubleWidth,
      bounds: nextBounds,
      idx,
    }

    charsQueue.set(char, newChar)
    updateNextBounds(isDoubleWidth)
  } else {
    // First char in font atlas

    const width = isDoubleWidth ? cell.width * 2 : cell.width

    const bounds = {
      left: 0,
      right: width,
      top: 0,
      bottom: cell.height,
    }

    // `updateNextBounds` needs `nextBounds` to be defined
    nextBounds = bounds
    updateNextBounds(isDoubleWidth)

    newChar = {
      char,
      idx,
      isDoubleWidth,
      bounds,
    }

    charsQueue.set(char, newChar)
  }

  charsByIdx.set(idx, newChar)
  return newChar
}

export const getCharFromIndex = (idx: number) => charsByIdx.get(idx)

ctx.font = `${font.size}px ${font.face}`
ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
ctx.textBaseline = 'top'
ctx.fillStyle = 'white'

for (let ix = 32; ix < 127; ix++) {
  getChar(String.fromCharCode(ix), false)
}

const genAtlas = (redrawWithAllCharsInAtlas: boolean) => {
  const draw = (char: AtlasChar, charStr: string) => {
    const charWidth = char.isDoubleWidth ? cell.width * 2 : cell.width
    const x = char.bounds.left
    const y = char.bounds.bottom + 3

    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, charWidth, cell.height)
    ctx.fillText(charStr, x, y, charWidth)
    ctx.restore()

    charsInAtlas.set(charStr, char)
  }

  charsQueue.forEach(draw)
  if (redrawWithAllCharsInAtlas) charsInAtlas.forEach(draw)

  charsQueue.clear()
}

export const getUpdatedFontAtlasMaybe = () => {
  if (!isEmpty(charsQueue)) {
    genAtlas(false)
    return canvas
  }
}

/** To be used when the workspace font has changed */
export const forceRegenerateFontAtlas = () => {
  // All the bounds are invalidated, so need to redo those as well.
  const chars: [boolean, number, string][] = []
  charsInAtlas.forEach((atlasChar, charStr) =>
    chars.push([atlasChar.isDoubleWidth, atlasChar.idx, charStr])
  )
  charsQueue.forEach((atlasChar, charStr) =>
    chars.push([atlasChar.isDoubleWidth, atlasChar.idx, charStr])
  )
  charsInAtlas.clear()
  charsQueue.clear()
  nextBounds = undefined

  canvas.width = Math.floor(atlasWidth * window.devicePixelRatio)
  ctx.font = `${font.size}px ${font.face}`
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'white'

  chars.forEach(([doubleWidth, charIdx, char]) => {
    const newChar = getChar(char, doubleWidth)
    // The index it receives from `getChar` isn't what it originally had,
    // so set that.
    // TODO(smolck): Potential source of issues that `charsIdx` isn't
    // updated/reset?
    newChar.idx = charIdx
    charsByIdx.set(charIdx, newChar)
  })

  genAtlas(true)
  return canvas
}

export default () => {
  if (!isEmpty(charsQueue)) {
    genAtlas(false)
  }
  return canvas
}
