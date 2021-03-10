import CreateWebGLBuffer from './grid-buffer'
import CreateWebGL from './utils'
import { cell } from '../../core/workspace'
import TextFG from './text-fg'
import WebGPU from '../webgpu'
import TextBG from './text-bg'
import { cursor as cursorState, CursorShape } from '../../core/cursor'
import { getActiveGridId } from '../../windows/window-manager'

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
  updateGridId: (gridId: number) => void
}

const nutella = () => {
  // const foregroundGL = CreateWebGL({ alpha: true, preserveDrawingBuffer: true })
  const backgroundGL = CreateWebGL({ alpha: true, preserveDrawingBuffer: true })

  // const textFGRenderer = TextFG(foregroundGL)
  const textBGRenderer = TextBG(backgroundGL)
  const canvasEl = document.createElement('canvas')
  const fgRenderer = WebGPU(canvasEl)

  const resizeCanvas = (width: number, height: number) => {
    textBGRenderer.resize(width, height)
    fgRenderer.then((val) => val!.resize(width, height))
    // textFGRenderer.resize(width, height)
  }

  const showCursor = (enable: boolean) => {
    textBGRenderer.showCursor(enable)
    // textFGRenderer.showCursor(enable)
    fgRenderer.then((val) => val!.setCursorVisible(enable))
  }

  const updateCursorShape = (shape: CursorShape) => {
    textBGRenderer.updateCursorShape(shape)
    // TODO(smolck): If cursor size changes need to update cells . . .
    textBGRenderer.updateCellSize(false, cursorState.size)

    fgRenderer.then((val) => val!.updateCursorShape(shape))
    // textFGRenderer.updateCursorShape(shape)
  }

  const updateCursorColor = (r: number, g: number, b: number) => {
    textBGRenderer.updateCursorColor([r, g, b])

    fgRenderer.then((val) => val!.updateCursorColor([1.0 - r, 1.0 - g, 1.0 - b]))
    // textFGRenderer.updateCursorColor([1.0 - r, 1.0 - g, 1.0 - b])
  }

  const updateCursorPosition = (row: number, col: number) => {
    textBGRenderer.updateCursorPosition(row, col)

    fgRenderer.then((val) => val!.updateCursorPosition(row, col))
    // textFGRenderer.updateCursorPosition(row, col)
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    // textFGRenderer.updateFontAtlas(fontAtlas)
    fgRenderer.then((val) => val!.updateFontAtlas(fontAtlas))
  }

  const updateCellSize = () => {
    textBGRenderer.updateCellSize()
    fgRenderer.then((val) => val!.updateCellSize())
    // textFGRenderer.updateCellSize()
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    textBGRenderer.updateColorAtlas(colorAtlas)
    fgRenderer.then((val) => val!.updateColorAtlas(colorAtlas))
    // textFGRenderer.updateColorAtlas(colorAtlas)
  }

  const clearAll = () => {
    textBGRenderer.clearAll()
    // textFGRenderer.clearAll()
    // TODO(smolck): fgRenderer.then((val) => val!.clearAll())
  }

  const createView = (initialGridId: number): WebGLView => {
    let gridId = initialGridId
    const viewport = { x: 0, y: 0, width: 0, height: 0 }
    const gridSize = { rows: 0, cols: 0 }
    const gridBuffer = CreateWebGLBuffer()
    let dataBuffer = new Float32Array()

    const updateGridId = (newGridId: number) => (gridId = newGridId)

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

      const doHacks = gridId !== getActiveGridId() && cursorState.visible
      if (doHacks) showCursor(false)
      textBGRenderer.render(buffer, x, y, width, height)
      fgRenderer.then((val) => val!.render(buffer, x, y, width, height))
      // textFGRenderer.render(buffer, x, y, width, height)
      if (doHacks) showCursor(true)
    }

    const renderGridBuffer = () => {
      const { x, y, width, height } = viewport
      const buffer = gridBuffer.getBuffer()

      const doHacks = gridId !== getActiveGridId() && cursorState.visible
      if (doHacks) showCursor(false)
      textBGRenderer.render(buffer, x, y, width, height)
      // textFGRenderer.render(buffer, x, y, width, height)
      fgRenderer.then((val) => val!.render(buffer, x, y, width, height))
      if (doHacks) showCursor(true)
    }

    const clear = () => {
      const { x, y, width, height } = viewport
      textBGRenderer.clear(x, y, width, height)

      // TODO(smolck): fgRenderer.then((val) => val!.clear(x, y, width, height))
      // textFGRenderer.clear(x, y, width, height)
    }

    const clearGridBuffer = () => gridBuffer.clear()

    const moveRegionUp = (lines: number, top: number, bottom: number) => {
      gridBuffer.moveRegionUp(lines, top, bottom)
      const buffer = gridBuffer.getBuffer()
      const { x, y, width, height } = viewport
      textBGRenderer.render(buffer, x, y, width, height)
      fgRenderer.then((val) => val!.render(buffer, x, y, width, height))
      // textFGRenderer.render(buffer, x, y, width, height)
    }

    const moveRegionDown = (lines: number, top: number, bottom: number) => {
      gridBuffer.moveRegionDown(lines, top, bottom)
      const buffer = gridBuffer.getBuffer()
      const { x, y, width, height } = viewport
      textBGRenderer.render(buffer, x, y, width, height)
      fgRenderer.then((val) => val!.render(buffer, x, y, width, height))
      // textFGRenderer.render(buffer, x, y, width, height)
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
      updateGridId,
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
    updateCursorShape,
    updateCursorPosition,
    updateCursorColor,
    showCursor,
    foregroundElement: canvasEl,
    // foregroundElement: foregroundGL.canvasElement,
    backgroundElement: backgroundGL.canvasElement,
  }
}

export default nutella
export type WebGLRenderer = ReturnType<typeof nutella>
