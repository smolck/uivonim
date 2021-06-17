import { getCharFromUnicode } from '../font-atlas'
import { cell } from '../../workspace'

const finetti = () => {
  let buffer = new Float32Array()
  let texCoordsBuffer = new Float32Array()
  let width = 0

  // @ts-ignore
  window.getTexCoordsBuffer = () => texCoordsBuffer

  const getTexCoordsBounds = ({ row, col, oldWidth, localBuffer }: { row: number, col: number, oldWidth: number, localBuffer: Float32Array }) => {
    const ix = col * 12 + oldWidth * row * 12
    // TODO(smolck): This is heavily dependent on the vertex positions as set in `setTexCoords` (order, vals, etc.);
    // if those change, this needs to change (although those shouldn't really
    // need to change?). Maybe fix that/make that statically checked or
    // something.
    return {
      left: localBuffer[ix],
      top: localBuffer[ix + 1],
      right: localBuffer[ix + 2],
      bottom: localBuffer[ix + 3]
    }
  }

  const setTexCoords = ({
    row,
    col,
    bounds
  }: {
    row: number,
    col: number,
    bounds: {
      left: number, right: number, top: number, bottom: number,
    }
  }) => {
    const ix = col * 12 + width * row * 12
    texCoordsBuffer[ix] = bounds.left
    texCoordsBuffer[ix + 1] = bounds.top

    texCoordsBuffer[ix + 2] = bounds.right
    texCoordsBuffer[ix + 3] = bounds.bottom

    texCoordsBuffer[ix + 4] = bounds.left
    texCoordsBuffer[ix + 5] = bounds.bottom


    texCoordsBuffer[ix + 6] = bounds.right
    texCoordsBuffer[ix + 7] = bounds.top

    texCoordsBuffer[ix + 8] = bounds.right
    texCoordsBuffer[ix + 9] = bounds.bottom

    texCoordsBuffer[ix + 10] = bounds.left
    texCoordsBuffer[ix + 11] = bounds.top
  }

  const setCell = ({
    row,
    col,
    hlId,
    charIdx,
    atlasBounds,
    isSecondHalfOfDoubleWidthCell,
  }: {
    row: number
    col: number
    hlId: number
    charIdx: number
    isSecondHalfOfDoubleWidthCell: boolean
    atlasBounds: {
      left: number, right: number, top: number, bottom: number,
    }
  }) => {
    const bufix = col * 5 + width * row * 5
    buffer[bufix] = col
    buffer[bufix + 1] = row
    buffer[bufix + 2] = hlId
    buffer[bufix + 3] = charIdx
    buffer[bufix + 4] = isSecondHalfOfDoubleWidthCell ? 1 : 0

    setTexCoords({ row, col, bounds: atlasBounds })
  }

  const getCellLocal = (
    theBuffer: Float32Array,
    localWidth: number,
    row: number,
    col: number
  ) => {
    const ix = col * 5 + localWidth * row * 5

    return {
      col: theBuffer[ix],
      row: theBuffer[ix + 1],
      hlId: theBuffer[ix + 2],
      charIdx: theBuffer[ix + 3],
      isSecondHalfOfDoubleWidthCell: theBuffer[ix + 4],
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
  ) => {
    const bufix = col * 5 + width * row * 5
    theBuffer[bufix] = col
    theBuffer[bufix + 1] = row
    theBuffer[bufix + 2] = hlId
    // TODO(smolck): But why
    if (samePos && charIdx) theBuffer[bufix + 3] = charIdx
    if (samePos && isSecondHalfOfDoubleWidthCell)
      theBuffer[bufix + 4] = isSecondHalfOfDoubleWidthCell
  }

  const resize = (rows: number, cols: number) => {
    const prevBuffer = buffer
    const prevWidth = width
    const prevTexCoordsBuffer = texCoordsBuffer
    width = cols
    buffer = new Float32Array(rows * cols * 5)
    texCoordsBuffer = new Float32Array(rows * cols * 12)
    const size = buffer.length

    // this approach of incrementing the col/row seems to be
    // about 2x faster than doing interger & mod quick maffs
    // just for ref:
    // col = (ix / 4) % width
    // row = ~~((ix / 4) / width)
    let col = 0
    let row = 0

    for (let ix = 0; ix < size; ix += 5) {
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
      )
      samePos && setTexCoords({ row, col, bounds: getTexCoordsBounds({ row, col, oldWidth: prevWidth, localBuffer: prevTexCoordsBuffer }) })

      col++
      if (col >= width) {
        row++
        col = 0
      }
    }
  }

  /*const clearTexCoords = () => {
    for (let ix = 0; ix < texCoordsBuffer.length; ix += 12) {
      texCoordsBuffer[]
    }
  }*/

  const clear = () => {
    const size = buffer.length
    let col = 0
    let row = 0

    // TODO(smolck): Necessary?
    // clearTexCoords()

    // TODO(smolck): This looks to be really wrong with how it's iterating
    // over things . . . is it?
    for (let ix = 0; ix < size; ix++) {
      buffer[ix] = col
      buffer[ix + 1] = row
      buffer[ix + 2] = 0

      // TODO(smolck)
      buffer[ix + 3] = 0
      buffer[ix + 4] = 0

      col++
      if (col >= width) {
        row++
        col = 0
      }
    }
  }

  const getCell = (row: number, col: number) => {
    const ix = col * 5 + width * row * 5
    return buffer.slice(ix, ix + 5)
  }

  const getLine = (row: number) => {
    const start = width * row * 5
    const end = width * 5 + width * row * 5
    return buffer.slice(start, end)
  }

  const moveRegionUp = (lines: number, top: number, bottom: number) => {
    let startIndex = width * (top + lines) * 5
    let offset = lines * width * 5
    let bottomIndex = width * bottom * 5 + width * 5

    for (let ix = startIndex; ix <= bottomIndex; ix += 5) {
      buffer[ix - offset] = buffer[ix]
      buffer[ix - offset + 1] = buffer[ix + 1] - lines
      buffer[ix - offset + 2] = buffer[ix + 2]
      buffer[ix - offset + 3] = buffer[ix + 3]
      buffer[ix - offset + 4] = buffer[ix + 4]
      buffer[ix + 2] = 0
      buffer[ix + 3] = 0
      buffer[ix + 4] = 0
    }

    // Now for the texCoordsBuffer
    startIndex = width * (top + lines) * 12
    offset = lines * width * 12
    bottomIndex = width * bottom * 12 + width * 12
    
    for (let ix = startIndex; ix <= bottomIndex; ix += 12) {
      texCoordsBuffer[ix - offset] = texCoordsBuffer[ix]
      texCoordsBuffer[ix - offset + 1] = texCoordsBuffer[ix + 1]
      texCoordsBuffer[ix - offset + 2] = texCoordsBuffer[ix + 2]
      texCoordsBuffer[ix - offset + 3] = texCoordsBuffer[ix + 3]
      texCoordsBuffer[ix - offset + 4] = texCoordsBuffer[ix + 4]
      texCoordsBuffer[ix - offset + 5] = texCoordsBuffer[ix + 5]
      texCoordsBuffer[ix - offset + 6] = texCoordsBuffer[ix + 6]
      texCoordsBuffer[ix - offset + 7] = texCoordsBuffer[ix + 7]
      texCoordsBuffer[ix - offset + 8] = texCoordsBuffer[ix + 8]
      texCoordsBuffer[ix - offset + 9] = texCoordsBuffer[ix + 9]
      texCoordsBuffer[ix - offset + 10] = texCoordsBuffer[ix + 10]
      texCoordsBuffer[ix - offset + 11] = texCoordsBuffer[ix + 11]
      // TODO(smolck): Need to zero out old bounds??
    }
  }

  const moveRegionDown = (lines: number, top: number, bottom: number) => {
    let startIndex = width * top * 5
    let offset = lines * width * 5
    let bottomIndex = width * bottom * 5 + width * 5
    let endIndex = bottomIndex - offset

    for (let ix = endIndex; ix >= startIndex; ix -= 5) {
      buffer[ix + offset] = buffer[ix]
      buffer[ix + offset + 1] = buffer[ix + 1] + lines
      buffer[ix + offset + 2] = buffer[ix + 2]
      buffer[ix + offset + 3] = buffer[ix + 3]
      buffer[ix + offset + 4] = buffer[ix + 4]
      buffer[ix + 2] = 0
      buffer[ix + 3] = 0
      buffer[ix + 4] = 0
    }

    // Now for the texCoordsBuffer
    startIndex = width * top * 12
    offset = lines * width * 12
    bottomIndex = width * bottom * 12 + width * 12
    endIndex = bottomIndex - offset

    for (let ix = startIndex; ix <= bottomIndex; ix += 12) {
      texCoordsBuffer[ix + offset] = texCoordsBuffer[ix]
      texCoordsBuffer[ix + offset + 1] = texCoordsBuffer[ix + 1]
      texCoordsBuffer[ix + offset + 2] = texCoordsBuffer[ix + 2]
      texCoordsBuffer[ix + offset + 3] = texCoordsBuffer[ix + 3]
      texCoordsBuffer[ix + offset + 4] = texCoordsBuffer[ix + 4]
      texCoordsBuffer[ix + offset + 5] = texCoordsBuffer[ix + 5]
      texCoordsBuffer[ix + offset + 6] = texCoordsBuffer[ix + 6]
      texCoordsBuffer[ix + offset + 7] = texCoordsBuffer[ix + 7]
      texCoordsBuffer[ix + offset + 8] = texCoordsBuffer[ix + 8]
      texCoordsBuffer[ix + offset + 9] = texCoordsBuffer[ix + 9]
      texCoordsBuffer[ix + offset + 10] = texCoordsBuffer[ix + 10]
      texCoordsBuffer[ix + offset + 11] = texCoordsBuffer[ix + 11]
      // TODO(smolck): Need to zero out old bounds??
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
    getTexCoordsBuffer: () => texCoordsBuffer,
    resetAtlasBounds: () => {
      for (let ix = 0; ix < buffer.length; ix += 5) {
        // TODO(smolck)
        const char = getCharFromUnicode(buffer[ix + 3])
        if (!char)
          console.warn(
            `Hmm resetting atlas bounds and couldn't find char ${
              buffer[ix + 3]
            }`
          )

        /*if (buffer[ix + 4] == 1) {
          buffer[ix + 5] = char!.bounds.left 
            // TODO(smolck): Make sure this works
            + (char!.advance / 2)
          buffer[ix + 6] = char!.bounds.bottom
        } else {
          buffer[ix + 5] = char!.bounds.left
          buffer[ix + 6] = char!.bounds.bottom
        }*/
      }
    },
  }
}

export default finetti
export type WebGLBuffer = ReturnType<typeof finetti>
