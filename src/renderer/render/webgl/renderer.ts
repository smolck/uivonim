import CreateWebGLBuffer from './grid-buffer'
import CreateWebGL from './utils'
import { cell } from '../../workspace'
import TextFG from './text-fg'
import TextBG from './text-bg'
import { cursor as cursorState } from '../../cursor'
import { CursorShape } from '../../../common/types'
import { getActiveGridId } from '../../windows/window-manager'
import { AtlasChar } from '../font-texture-atlas'

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
  setGridBufferCell: (info: { 
    row: number,
    col: number,
    hlId: number,
    atlasChar: AtlasChar,
  }) => void
  getBuffer: () => Float32Array
  updateGridId: (gridId: number) => void
  resetAtlasBounds: () => void
}

const nutella = () => {
  const foregroundGL = CreateWebGL({ alpha: true, preserveDrawingBuffer: true })
  const backgroundGL = CreateWebGL({ alpha: true, preserveDrawingBuffer: true })

  let fontAtlasCache: HTMLCanvasElement

  let textFGRenderer = TextFG(foregroundGL)
  let textBGRenderer = TextBG(backgroundGL)

  const resizeCanvas = (width: number, height: number) => {
    textBGRenderer.resize(width, height)
    textFGRenderer.resize(width, height)
  }

  const showCursor = (enable: boolean) => {
    textBGRenderer.showCursor(enable)
    textFGRenderer.showCursor(enable)
  }

  const updateCursorShape = (shape: CursorShape) => {
    textBGRenderer.updateCursorShape(shape)
    // TODO(smolck): If cursor size changes need to update cells . . .
    textBGRenderer.updateCellSize(false, cursorState.size)

    textFGRenderer.updateCursorShape(shape)
  }

  const updateCursorColor = (r: number, g: number, b: number) => {
    textBGRenderer.updateCursorColor([r, g, b])
    textFGRenderer.updateCursorColor([1.0 - r, 1.0 - g, 1.0 - b])
  }

  const updateCursorPosition = (row: number, col: number) => {
    textBGRenderer.updateCursorPosition(row, col)
    textFGRenderer.updateCursorPosition(row, col)
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    textFGRenderer.updateFontAtlas(fontAtlas)
    fontAtlasCache = fontAtlas
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
      dataBuffer = new Float32Array(rows * cols * 7)
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
      textFGRenderer.render(buffer, x, y, width, height)
      if (doHacks) showCursor(true)
    }

    const renderGridBuffer = () => {
      const { x, y, width, height } = viewport
      const buffer = gridBuffer.getBuffer()

      const doHacks = gridId !== getActiveGridId() && cursorState.visible
      if (doHacks) showCursor(false)
      textBGRenderer.render(buffer, x, y, width, height)
      textFGRenderer.render(buffer, x, y, width, height)
      if (doHacks) showCursor(true)
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
      updateGridId,
      getGridCell: gridBuffer.getCell,
      getGridLine: gridBuffer.getLine,
      setGridBufferCell: gridBuffer.setCell,
      getBuffer: () => dataBuffer,
      resetAtlasBounds: () => {
        gridBuffer.resetAtlasBounds()
        gridBuffer.resetAtlasBounds(dataBuffer)
      },
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
    foregroundElement: foregroundGL.canvasElement,
    backgroundElement: backgroundGL.canvasElement,
    reInit: ({ fg, bg }: { fg: boolean; bg: boolean }) => {
      if (fg) {
        textFGRenderer = TextFG(foregroundGL)
        updateFontAtlas(fontAtlasCache)
      }
      if (bg) textBGRenderer = TextBG(backgroundGL)

      showCursor(cursorState.visible)
      updateCursorPosition(cursorState.row, cursorState.col)
      updateCursorShape(cursorState.shape)
      updateCursorColor(
        cursorState.color[0],
        cursorState.color[1],
        cursorState.color[2]
      )
    },
  }
}

export default nutella
export type WebGLRenderer = ReturnType<typeof nutella>
