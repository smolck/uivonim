import { colors } from '../highlight-attributes'
import { cell } from '../../core/workspace'
import { createCanvas } from './utils'
import { font } from '../../core/workspace'

/*const initEmptyLines = (rows: number, cols: number): Array<Array<string>> => {
  let lines = new Array(rows)

  for (let i = 0; i < rows; i++) {
    lines[i] = new Array(...' '.repeat(cols))
  }

  return lines
}*/

const resizeArray = (inputArr: Array<Array<string>>, rows: number, cols: number) => {
  if (inputArr.length < rows) {
    const len = inputArr.length
    for (let i = 0; i < rows - len; i++) {
      let empty = new Array(cols)
      empty = empty.fill(' ')
      inputArr.push(empty)
    }
  } else if (inputArr.length > rows) {
    inputArr = inputArr.slice(0, rows)
  }

  const lessThan = inputArr[0].length < cols
  const greaterThan = inputArr[0].length > cols
  for (let i = 0; i < inputArr.length; i++) {
    if (lessThan) {
      inputArr[i].push(...((new Array(cols)).fill(' ')))
    } else if (greaterThan) {
      inputArr[i] = inputArr[i].slice(0, cols)
    }
  }

  console.assert(inputArr.length === rows, `inputArr.length == ${inputArr.length}, rows == ${rows}`)
  console.assert(inputArr[0].length === cols)
}

const m = (initialGridId: number) => {
  let gridId = initialGridId
  const canvas = createCanvas()
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("NEED A CONTEXT!!!!")

  const gridSize = { rows: 0, cols: 0 }
  let lines: Array<Array<string>> = [] // initEmptyLines(gridSize.rows, gridSize.cols)

  const render = () => {
    ctx.font = `${font.size}px ${font.face}`
    ctx.fillStyle = `${colors.foreground}`
    lines.forEach((line, idx) => {
      ctx.fillText(line.join(''), 0, idx * cell.height)
    })
  }

  const updateThingNess = (row: number, startCol: number, cells: any[]) => {
    cells.forEach((cell, idx) => {
      const [text, hlId, repeat] = cell
      if (repeat) {
        lines[row] = lines[row].fill(text, startCol + idx, startCol + idx + repeat)
      } else {
        lines[row][startCol + idx] = text
      }
    })

    // if (lines.length < row || lines[0].length < col) { console.log("WE GOT ISSUES"); return }
  }

  const resizeGrid = (rows: number, cols: number) => {
    const width = cols * cell.width
    const height = rows * cell.height

    const sameGridSize = gridSize.rows == rows && gridSize.cols == cols
    const sameCanvasSize = canvas.height == height || canvas.width == width
    if (sameGridSize && sameCanvasSize) return

    Object.assign(gridSize, { rows, cols })
    if (!sameGridSize) resizeArray(lines, rows, cols)
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
    console.log('clear bro!!!!!')
    for (let i = 0; i < lines.length; i++) {
      lines[i] = lines[i].fill(' ')
      /* for (let g = 0; g < lines[i].length; g++) {
        lines[i][g] = ' '
      } */
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
