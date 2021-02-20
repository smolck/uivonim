import { colors, getColorById, Color } from '../highlight-attributes'
import { cell as workspaceCell } from '../../core/workspace'
import { createCanvas } from './utils'
import { font } from '../../core/workspace'

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
  let lines: Array<Array<Cell>> = [] // initEmptyLines(gridSize.rows, gridSize.cols)

  const render = () => {
    ctx.fillStyle = `${colors.background}`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.font = `${font.size * window.devicePixelRatio}px ${font.face}`
    ctx.fillStyle = `${colors.foreground}`

    let prevHighlight: Color = { foreground: colors.foreground, background: colors.background }
    const scaledW = workspaceCell.width * window.devicePixelRatio
    const scaledH = workspaceCell.height * window.devicePixelRatio
    lines.forEach((line, idx) => {
      if (line[0].highlight) prevHighlight = line[0].highlight

      line.forEach((cell, idx2) => {
        if (cell.highlight) {
          prevHighlight = cell.highlight
        }
        const bg = prevHighlight.background || colors.background
        const fg = prevHighlight.foreground || colors.foreground

        const x = idx2 * scaledW
        const y = (idx + 1) * scaledH

        ctx.fillStyle = bg
        ctx.fillRect(x, idx * scaledH + (workspaceCell.padding * 2), scaledW, scaledH)

        ctx.save()

        ctx.fillStyle = fg

        // Glowing text
        ctx.shadowColor = fg
        ctx.shadowBlur = 10

        ctx.fillText(cell.text, x, y)

        ctx.restore()
      })
    })
  }

  const updateThingNess = (row: number, startCol: number, cells: any[]) => {
    // Algorithm mostly from https://github.com/vhakulinen/gnvim/blob/284c3734a2da25663ce9a9258f8ac5e7f3ad2847/src/ui/grid/row.rs#L125-L134
    let offset = startCol
    cells.forEach((cell) => {
      const [text, hlId, maybeRepeat] = cell
      const repeat = maybeRepeat ? (maybeRepeat == 0 ? 1 : maybeRepeat) : 1
      for (let r = 0; r < repeat; r++) {
        lines[row][offset + r] = { text, highlight: hlId ? getColorById(hlId) : undefined }
      }

      offset += repeat
    })
  }

  const resizeGrid = (rows: number, cols: number) => {
    const width = cols * workspaceCell.width
    const height = rows * workspaceCell.height

    const sameGridSize = gridSize.rows == rows && gridSize.cols == cols
    const sameCanvasSize = canvas.height == height || canvas.width == width
    if (sameGridSize && sameCanvasSize) return

    Object.assign(gridSize, { rows, cols })
    if (!sameGridSize) lines = resizeArray(lines, rows, cols)
    if (!sameCanvasSize) canvas.resize(width, height)
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

  const getGridCell = (row: number, col: number) => lines[row][col]

  const getGridLine = (row: number) => lines[row].join('')

  const clearGrid = () => {
    for (let i = 0; i < lines.length; i++) {
      lines[i] = lines[i].fill({ text: ' '})
    }
  }

  return {
    clearGrid,
    getGridCell,
    getGridLine,
    updateGridId,
    updateThingNess,
    render,
    clearAll,
    clearArea,
    resizeCanvas,
    resizeGrid,
    canvasElement: canvas,
  }
}

export default m
export type Canvas2dRenderer = ReturnType<typeof m>
