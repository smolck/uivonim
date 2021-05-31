import { cell, font } from '../workspace'

interface AtlasCharBounds {
  left: number,
  right: number,
  top: number,
  bottom: number,
}

interface AtlasChar {
  char: string
  isDoubleWidth: boolean
  bounds: AtlasCharBounds
}

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)
// TODO(smolck)
const atlasWidth = 1000
const atlasHeight = 200

canvas.width = Math.floor(atlasWidth * window.devicePixelRatio)
canvas.height = Math.floor(atlasHeight * window.devicePixelRatio)

const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
const charsInAtlas = new Map<string, AtlasChar>()
const charsQueue = new Map<string, AtlasChar>()
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

  // Normalize oldBounds.right
  const moveDown = (oldBounds.right * atlasWidth) + cell.width >= atlasWidth

  const charHeight = cell.height / atlasHeight
  const charWidth =
    // Normalized
    (isDoubleWidth ? (cell.width * 2) : cell.width) / atlasWidth

  nextBounds = moveDown ? {
    left: 0,
    right: charWidth,
    top: oldBounds.top + charHeight,
    bottom: oldBounds.bottom + charHeight,
  } : {
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
  if (nextBounds) {
    const newChar = {
      char,
      isDoubleWidth,
      bounds: nextBounds,
    }

    charsQueue.set(char, newChar)
    updateNextBounds(isDoubleWidth)

    return newChar
  } else {
    // First char in font atlas

    // Normalize width by dividing by atlasWidth
    const width = (isDoubleWidth ? (cell.width * 2) : cell.width) / atlasWidth

    const bounds = {
      left: 0,
      right: width,
      top: 0,
      bottom: cell.height / atlasHeight,
    }

    // `updateNextBounds` needs `nextBounds` to be defined
    nextBounds = bounds;
    updateNextBounds(isDoubleWidth)

    const newChar = {
      char,
      isDoubleWidth,
      bounds: nextBounds,
    }

    charsQueue.set(char, newChar)
    return newChar
  }
}

console.log(getChar)

for (let ix = 32; ix < 127; ix++) {
  getChar(String.fromCharCode(ix), false)
}

const genAtlas = (redrawWithAllCharsInAtlas: boolean) => {
  console.log('gen that atlas!', charsQueue, charsInAtlas, font)

  ctx.imageSmoothingEnabled = false
  ctx.font = `${font.size}px ${font.face}`
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'white'

  const draw = (char: AtlasChar, charStr: string) => {
    const charWidth = char.isDoubleWidth ? cell.width * 2 : cell.width
    const x = char.bounds.left * atlasWidth
    const y = char.bounds.bottom * atlasHeight

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
  // TODO(smolck): How to update the bounds for the grid buffer(s)?

  // All the bounds are invalidated, so need to redo those as well.
  const chars: [boolean, string][] = []
  charsInAtlas.forEach((atlasChar, charStr) => chars.push([atlasChar.isDoubleWidth, charStr]))
  charsQueue.forEach((atlasChar, charStr) => chars.push([atlasChar.isDoubleWidth, charStr]))
  charsInAtlas.clear()
  charsQueue.clear()
  nextBounds = undefined

  ctx.clearRect(0, 0, atlasWidth, atlasHeight)
  chars.forEach(([doubleWidth, char]) => getChar(char, doubleWidth))

  genAtlas(true)
  return canvas
}

export default () => {
  if (!isEmpty(charsQueue)) {
    genAtlas(false)
  }
  return canvas
}
