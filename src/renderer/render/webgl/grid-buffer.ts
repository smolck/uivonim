import { getCharFromIndex } from '../font-texture-atlas'
import { cell } from '../../workspace'

const finetti = () => {
  let buffer = new Float32Array()
  let width = 0

  const setCell = ({
    row,
    col,
    hlId,
    charIdx,
    leftAtlasBounds,
    bottomAtlasBounds,
    isSecondHalfOfDoubleWidthCell,
  }: {
    row: number
    col: number
    hlId: number
    charIdx: number
    isSecondHalfOfDoubleWidthCell: boolean
    leftAtlasBounds: number
    bottomAtlasBounds: number
  }) => {
    const bufix = col * 7 + width * row * 7
    buffer[bufix] = col
    buffer[bufix + 1] = row
    buffer[bufix + 2] = hlId
    buffer[bufix + 3] = charIdx
    buffer[bufix + 4] = isSecondHalfOfDoubleWidthCell ? 1 : 0
    buffer[bufix + 5] = leftAtlasBounds
    buffer[bufix + 6] = bottomAtlasBounds
  }

  const getCellLocal = (
    theBuffer: Float32Array,
    localWidth: number,
    row: number,
    col: number
  ) => {
    const ix = col * 7 + localWidth * row * 7

    return {
      col: theBuffer[ix],
      row: theBuffer[ix + 1],
      hlId: theBuffer[ix + 2],
      charIdx: theBuffer[ix + 3],
      isSecondHalfOfDoubleWidthCell: theBuffer[ix + 4],
      leftTexBounds: theBuffer[ix + 5],
      topTexBounds: theBuffer[ix + 6],
    }
  }

  const setCellLocal = (
    samePos: boolean,
    theBuffer: Float32Array,
    col: number,
    row: number,
    hlId: number,
    charIdx: number,
    isSecondHalfOfDoubleWidthCell: number,
    leftBounds: number,
    topBounds: number
  ) => {
    const bufix = col * 7 + width * row * 7
    theBuffer[bufix] = col
    theBuffer[bufix + 1] = row
    theBuffer[bufix + 2] = hlId
    // TODO(smolck): But why
    if (samePos && charIdx) theBuffer[bufix + 3] = charIdx
    if (samePos && isSecondHalfOfDoubleWidthCell)
      theBuffer[bufix + 4] = isSecondHalfOfDoubleWidthCell
    if (samePos && leftBounds) theBuffer[bufix + 5] = leftBounds
    if (samePos && topBounds) theBuffer[bufix + 6] = topBounds
  }

  const resize = (rows: number, cols: number) => {
    const prevBuffer = buffer
    const prevWidth = width
    width = cols
    buffer = new Float32Array(rows * cols * 7)
    const size = buffer.length

    // this approach of incrementing the col/row seems to be
    // about 2x faster than doing integer & mod quick maffs
    // just for ref:
    // col = (ix / 4) % width
    // row = ~~((ix / 4) / width)
    let col = 0
    let row = 0

    for (let ix = 0; ix < size; ix += 7) {
      const cell = getCellLocal(prevBuffer, prevWidth, row, col)
      // TODO: im so tired right now, i don't understand
      // why the col/row -> index lookup above is returning
      // back the wrong col/row. i'm sure it's obvious but
      // i'm too dumb right now
      const samePos = cell.col === col && cell.row === row

      // TODO(smolck): Need ifs?
      // if (cell.hlId && samePos) buffer[ix + 2] = cell.hlId
      // if (cell.charIdx && samePos) buffer[ix + 3] = cell.charIdx
      setCellLocal(
        samePos,
        buffer,
        col,
        row,
        cell.hlId,
        cell.charIdx,
        cell.isSecondHalfOfDoubleWidthCell,
        cell.leftTexBounds,
        cell.topTexBounds
      )

      col++
      if (col >= width) {
        row++
        col = 0
      }
    }
  }

  const clear = () => {
    const size = buffer.length
    let col = 0
    let row = 0

    for (let ix = 0; ix < size; ix++) {
      buffer[ix] = col
      buffer[ix + 1] = row
      buffer[ix + 2] = 0

      // TODO(smolck)
      buffer[ix + 3] = 0
      buffer[ix + 4] = 0
      buffer[ix + 5] = 0
      buffer[ix + 6] = 0

      col++
      if (col >= width) {
        row++
        col = 0
      }
    }
  }

  const getCell = (row: number, col: number) => {
    const ix = col * 7 + width * row * 7
    return buffer.slice(ix, ix + 7)
  }

  const getLine = (row: number) => {
    const start = width * row * 7
    const end = width * 7 + width * row * 7
    return buffer.slice(start, end)
  }

  const moveRegionUp = (lines: number, top: number, bottom: number) => {
    const startIndex = width * (top + lines) * 7
    const offset = lines * width * 7
    const bottomIndex = width * bottom * 7 + width * 7

    for (let ix = startIndex; ix <= bottomIndex; ix += 7) {
      buffer[ix - offset] = buffer[ix]
      buffer[ix - offset + 1] = buffer[ix + 1] - lines
      buffer[ix - offset + 2] = buffer[ix + 2]
      buffer[ix - offset + 3] = buffer[ix + 3]
      buffer[ix - offset + 4] = buffer[ix + 4]
      buffer[ix - offset + 5] = buffer[ix + 5]
      buffer[ix - offset + 6] = buffer[ix + 6]
      buffer[ix + 2] = 0
      buffer[ix + 3] = 0
      buffer[ix + 4] = 0
      buffer[ix + 5] = 0
      buffer[ix + 6] = 0
    }
  }

  const moveRegionDown = (lines: number, top: number, bottom: number) => {
    const startIndex = width * top * 7
    const offset = lines * width * 7
    const bottomIndex = width * bottom * 7 + width * 7
    const endIndex = bottomIndex - offset

    for (let ix = endIndex; ix >= startIndex; ix -= 7) {
      buffer[ix + offset] = buffer[ix]
      buffer[ix + offset + 1] = buffer[ix + 1] + lines
      buffer[ix + offset + 2] = buffer[ix + 2]
      buffer[ix + offset + 3] = buffer[ix + 3]
      buffer[ix + offset + 4] = buffer[ix + 4]
      buffer[ix + offset + 5] = buffer[ix + 5]
      buffer[ix + offset + 6] = buffer[ix + 6]
      buffer[ix + 2] = 0
      buffer[ix + 3] = 0
      buffer[ix + 4] = 0
      buffer[ix + 5] = 0
      buffer[ix + 6] = 0
    }
  }

  return {
    clear,
    resize,
    getCell,
    setCell,
    getLine,
    moveRegionUp,
    moveRegionDown,
    getBuffer: () => buffer,
    resetAtlasBounds: () => {
      for (let ix = 0; ix < buffer.length; ix += 7) {
        const char = getCharFromIndex(buffer[ix + 3])
        if (!char)
          console.warn(
            `Hmm resetting atlas bounds and couldn't find char ${
              buffer[ix + 3]
            }`
          )

        if (buffer[ix + 4] == 1) {
          buffer[ix + 5] = char!.bounds.left + cell.width
          buffer[ix + 6] = char!.bounds.bottom
        } else {
          buffer[ix + 5] = char!.bounds.left
          buffer[ix + 6] = char!.bounds.bottom
        }
      }
    },
  }
}

export default finetti
