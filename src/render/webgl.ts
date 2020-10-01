import CreateWebGLBuffer from '../render/webgl-grid-buffer'
import CreateWebGL from '../render/webgl-utils'
import { cell } from '../core/workspace'
import TextFG from '../render/webgl-text-fg'
import TextBG from '../render/webgl-text-bg'

export interface WebGLView {
  resize: (rows: number, cols: number) => void
  layout: (x: number, y: number, width: number, height: number) => void
  render: (elements: number) => void
  renderGridBuffer: () => void
  clear: () => void
  clearGridBuffer: () => void
  moveRegionUp: (lines: number, top: number, bottom: number) => void
  moveRegionDown: (lines: number, top: number, bottom: number) => void
  getGridCell: (row: number, col: number) => Float32Array
  getGridLine: (row: number) => Float32Array
  getGridBuffer: () => Float32Array
  getBuffer: () => Float32Array
}

const nutella = () => {
  const foregroundGL = CreateWebGL({ alpha: true, preserveDrawingBuffer: true })
  const backgroundGL = CreateWebGL({ alpha: true, preserveDrawingBuffer: true })

  const textFGRenderer = TextFG(foregroundGL)
  const textBGRenderer = TextBG(backgroundGL)

  const resizeCanvas = (width: number, height: number) => {
    textBGRenderer.resize(width, height)
    textFGRenderer.resize(width, height)
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    textFGRenderer.updateFontAtlas(fontAtlas)
  }

  const updateCellSize = () => {
    textBGRenderer.updateCellSize()
    textFGRenderer.updateCellSize()
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    textBGRenderer.updateColorAtlas(colorAtlas)
    textFGRenderer.updateColorAtlas(colorAtlas)
  }

  const clearAll = () => {
    textBGRenderer.clearAll()
    textFGRenderer.clearAll()
  }

  const createView = (): WebGLView => {
    const viewport = { x: 0, y: 0, width: 0, height: 0 }
    const gridSize = { rows: 0, cols: 0 }
    const gridBuffer = CreateWebGLBuffer()
    let dataBuffer = new Float32Array()

    const resize = (rows: number, cols: number) => {
      const width = cols * cell.width
      const height = rows * cell.height

      const sameGridSize = gridSize.rows === rows && gridSize.cols === cols
      const sameViewportSize =
        viewport.height === height && viewport.width === width
      if (sameGridSize || sameViewportSize) return

      Object.assign(gridSize, { rows, cols })
      dataBuffer = new Float32Array(rows * cols * 4)
      gridBuffer.resize(rows, cols)
    }

    const layout = (x: number, y: number, width: number, height: number) => {
      const same =
        viewport.x === x &&
        viewport.y === y &&
        viewport.width === width &&
        viewport.height === height

      if (same) return

      Object.assign(viewport, { x, y, width, height })
    }

    const render = (elements: number) => {
      const buffer = dataBuffer.subarray(0, elements)
      const { x, y, width, height } = viewport
      textBGRenderer.render(buffer, x, y, width, height)
      textFGRenderer.render(buffer, x, y, width, height)
    }

    const renderGridBuffer = () => {
      const { x, y, width, height } = viewport
      const buffer = gridBuffer.getBuffer()
      textBGRenderer.render(buffer, x, y, width, height)
      textFGRenderer.render(buffer, x, y, width, height)
    }

    const clear = () => {
      const { x, y, width, height } = viewport
      textBGRenderer.clear(x, y, width, height)
      textFGRenderer.clear(x, y, width, height)
    }

    const clearGridBuffer = () => gridBuffer.clear()

    const moveRegionUp = (lines: number, top: number, bottom: number) => {
      gridBuffer.moveRegionUp(lines, top, bottom)
      const buffer = gridBuffer.getBuffer()
      const { x, y, width, height } = viewport
      textBGRenderer.render(buffer, x, y, width, height)
      textFGRenderer.render(buffer, x, y, width, height)
    }

    const moveRegionDown = (lines: number, top: number, bottom: number) => {
      gridBuffer.moveRegionDown(lines, top, bottom)
      const buffer = gridBuffer.getBuffer()
      const { x, y, width, height } = viewport
      textBGRenderer.render(buffer, x, y, width, height)
      textFGRenderer.render(buffer, x, y, width, height)
    }

    return {
      clear,
      render,
      resize,
      layout,
      moveRegionUp,
      moveRegionDown,
      clearGridBuffer,
      renderGridBuffer,
      getGridCell: gridBuffer.getCell,
      getGridLine: gridBuffer.getLine,
      getGridBuffer: gridBuffer.getBuffer,
      getBuffer: () => dataBuffer,
    }
  }

  return {
    clearAll,
    createView,
    resizeCanvas,
    updateCellSize,
    updateFontAtlas,
    updateColorAtlas,
    foregroundElement: foregroundGL.canvasElement,
    backgroundElement: backgroundGL.canvasElement,
  }
}

export default nutella
export type WebGLRenderer = ReturnType<typeof nutella>
