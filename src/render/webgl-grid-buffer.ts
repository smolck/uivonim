const finetti = () => {
  let buffer = new Float32Array()
  let width = 0

  const resize = (rows: number, cols: number) => {
    const prevBuffer = buffer
    const prevWidth = width
    width = cols
    buffer = new Float32Array(rows * cols * 4)
    const size = buffer.length

    // this approach of incrementing the col/row seems to be
    // about 2x faster than doing interger & mod quick maffs
    // just for ref:
    // col = (ix / 4) % width
    // row = ~~((ix / 4) / width)
    let col = 0
    let row = 0

    for (let ix = 0; ix < size; ix += 4) {
      const oldix = col * 4 + prevWidth * row * 4
      const prevCol = prevBuffer[oldix]
      const prevRow = prevBuffer[oldix + 1]
      const prevHlid = prevBuffer[oldix + 2]
      const prevChar = prevBuffer[oldix + 3]
      // TODO: im so tired right now, i don't understand
      // why the col/row -> index lookup above is returning
      // back the wrong col/row. i'm sure it's obvious but
      // i'm too dumb right now
      const samePos = prevCol === col && prevRow === row

      buffer[ix] = col
      buffer[ix + 1] = row

      if (prevHlid && samePos) buffer[ix + 2] = prevHlid
      if (prevChar && samePos) buffer[ix + 3] = prevChar

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
      buffer[ix + 3] = 0

      col++
      if (col >= width) {
        row++
        col = 0
      }
    }
  }

  const getCell = (row: number, col: number) => {
    const ix = col * 4 + width * row * 4
    return buffer.slice(ix, ix + 4)
  }

  const getLine = (row: number) => {
    const start = width * row * 4
    const end = width * 4 + width * row * 4
    return buffer.slice(start, end)
  }

  const moveRegionUp = (lines: number, top: number, bottom: number) => {
    const startIndex = width * (top + lines) * 4
    const offset = lines * width * 4
    const bottomIndex = width * bottom * 4 + width * 4

    for (let ix = startIndex; ix <= bottomIndex; ix += 4) {
      buffer[ix - offset] = buffer[ix]
      buffer[ix - offset + 1] = buffer[ix + 1] - lines
      buffer[ix - offset + 2] = buffer[ix + 2]
      buffer[ix - offset + 3] = buffer[ix + 3]
      buffer[ix + 2] = 0
      buffer[ix + 3] = 0
    }
  }

  const moveRegionDown = (lines: number, top: number, bottom: number) => {
    const startIndex = width * top * 4
    const offset = lines * width * 4
    const bottomIndex = width * bottom * 4 + width * 4
    const endIndex = bottomIndex - offset

    for (let ix = endIndex; ix >= startIndex; ix -= 4) {
      buffer[ix + offset] = buffer[ix]
      buffer[ix + 1 + offset] = buffer[ix + 1] + lines
      buffer[ix + 2 + offset] = buffer[ix + 2]
      buffer[ix + 3 + offset] = buffer[ix + 3]
      buffer[ix + 2] = 0
      buffer[ix + 3] = 0
    }
  }

  return {
    clear,
    resize,
    getCell,
    getLine,
    moveRegionUp,
    moveRegionDown,
    getBuffer: () => buffer,
  }
}

export default finetti
export type WebGLBuffer = ReturnType<typeof finetti>
