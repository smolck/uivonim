import { colors, getHighlight, Color } from '../highlight-attributes'
import { cell as workspaceCell } from '../../core/workspace'
import { createCanvas } from './utils'
import { font } from '../../core/workspace'
import { cursor, CursorShape } from '../../core/cursor'
import CreateGridBuffer from '../webgl/grid-buffer'
import { getCharFromIndex } from '../font-texture-atlas'

type Cell = {
  text: string
  highlight?: Color
}

const resizeArray = (inputArr: Array<Array<Cell>>, rows: number, cols: number) => {
  if (inputArr.length < rows) {
    const len = inputArr.length
    for (let i = 0; i < rows - len; i++) {
      let empty = new Array(cols)
      empty = empty.fill({ text: ' ', highlight: 0 })
      inputArr.push(empty)
    }
  } else if (inputArr.length > rows) {
    inputArr = inputArr.slice(0, rows)
  }

  const lessThan = inputArr[0].length < cols
  const greaterThan = inputArr[0].length > cols
  for (let i = 0; i < inputArr.length; i++) {
    if (lessThan) {
      inputArr[i].push(...((new Array(cols)).fill({ text: ' ', highlight: 0 })))
    } else if (greaterThan) {
      inputArr[i] = inputArr[i].slice(0, cols)
    }
  }

  console.assert(inputArr.length === rows, `inputArr.length == ${inputArr.length}, rows == ${rows}`)
  console.assert(inputArr[0].length === cols)

  return inputArr
}

const m = (initialGridId: number) => {
  let gridId = initialGridId
  const canvas = createCanvas()
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("NEED A CONTEXT!!!!")

  const gridSize = { rows: 0, cols: 0 }
  const gridBuffer = CreateGridBuffer()
  // let lines: Array<Array<Cell>> = [] // initEmptyLines(gridSize.rows, gridSize.cols)

  const moveRegionUp = (lines: number, top: number, bottom: number) => {
    gridBuffer.moveRegionUp(lines, top, bottom)
  }

  const moveRegionDown = (lines: number, top: number, bottom: number) => {
    gridBuffer.moveRegionDown(lines, top, bottom)
  }

  const renderCursor = () => {
    if (!cursor.visible) return

    const scaledW = workspaceCell.width * window.devicePixelRatio
    const scaledH = workspaceCell.height * window.devicePixelRatio

    const x = cursor.col * scaledW
    const y = cursor.row * scaledH + (workspaceCell.padding * 2)

    // TODO(smolck): look into when to do save() and restore() and when it isn't
    // necessary
    ctx.save()

    ctx.fillStyle = cursor.colorNice
    ctx.fillRect(x,
                 y,
                 cursor.shape == CursorShape.line ? scaledW / 10 : scaledW,
                 scaledH)

    if (cursor.shape === CursorShape.block) {
      ctx.fillStyle = colors.background
      let cell = gridBuffer.getCell(cursor.row, cursor.col)
      ctx.fillText(getCharFromIndex(cell[cell.length - 1]), x, (cursor.row + 1) * scaledH)
    }
    ctx.restore()
  }

  const render = () => {
    // ctx.fillStyle = `${colors.background}`
    // ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.font = `${font.size * window.devicePixelRatio}px ${font.face}`
    ctx.fillStyle = `${colors.foreground}`

    let prevHighlight: Color = { foreground: colors.foreground, background: colors.background }
    const scaledW = workspaceCell.width * window.devicePixelRatio
    const scaledH = workspaceCell.height * window.devicePixelRatio

    let col = 0
    let row = 0
    let buffer = gridBuffer.getBuffer()
    let width = gridBuffer.getWidth()
    let size = buffer.length
    for (let ix = 0; ix < size; ix += 4) {
      const ix = col * 4 + width * row * 4
      const hlid = buffer[ix + 2]
      // TODO(smolck): Just store char directly in gridbuffer?
      const char = getCharFromIndex(buffer[ix + 3])

      const highlight = getHighlight(hlid)
      if (highlight) {
        prevHighlight = highlight
      }
      const bg = prevHighlight.background || colors.background
      const fg = prevHighlight.foreground || colors.foreground

      const x = col * scaledW
      const y = (row + 1) * scaledH

      ctx.fillStyle = bg
      // TODO(smolck): This is just . . . no
      ctx.fillRect(x + (workspaceCell.padding * 2.5), row * scaledH + (workspaceCell.padding * 2), scaledW, scaledH)

      // ctx.save()
      ctx.fillStyle = fg

      // Glowing text
      // ctx.shadowColor = fg
      // ctx.shadowBlur = 10

      ctx.fillText(char, x, y)

      // ctx.restore()

      col++
      if (col >= width) {
        row++
        col = 0
      }
    }
  }

  const resizeGrid = (rows: number, cols: number) => {
    gridBuffer.resize(rows, cols)
  }

  const resizeCanvas = (width: number, height: number) => {
    canvas.resize(width, height)
  }

  const clearAll = () => {
    ctx.fillStyle = `${colors.background}`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const clearArea = (x: number, y: number, width: number, height: number) => {
    console.log("COLOR BACKGROUND", colors.background)

    ctx.fillStyle = `#${colors.background}`
    ctx.fillRect(x, y, width, height)
  }

  const updateGridId = (newGridId: number) => gridId = newGridId

  // const getGridCell = (row: number, col: number) => lines[row][col]
  // const getGridLine = (row: number) => lines[row].join('')
  const getGridCell = gridBuffer.getCell
  const getGridLine = gridBuffer.getLine

  const getGridBuffer = gridBuffer.getBuffer

  const clearGrid = () => {
    gridBuffer.clear()
    // for (let i = 0; i < lines.length; i++) {
      // lines[i] = lines[i].fill({ text: ' '})
    // }
  }

  return {
    moveRegionUp,
    moveRegionDown,
    renderCursor,
    clearGrid,
    getGridCell,
    getGridLine,
    updateGridId,
    // updateThingNess,
    render,
    clearAll,
    clearArea,
    resizeCanvas,
    resizeGrid,
    canvasElement: canvas,
    getGridBuffer,
  }
}

export default m
export type Canvas2dRenderer = ReturnType<typeof m>
