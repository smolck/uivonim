import CreateWebGLBuffer from './grid-buffer'
import { cursor as cursorState } from '../../cursor'
import { getActiveGridId } from '../../windows/window-manager'
import { getColorAtlas } from '../highlight-attributes'
import generateFontAtlas from '../font-texture-atlas'
import { cell } from '../../workspace'
import { CursorShape } from '../../../common/types'
import * as twgl from 'twgl.js'
// @ts-ignore
import fgVertShader from './shaders/fg-vert.glsl'
// @ts-ignore
import fgFragShader from './shaders/fg-frag.glsl'
// @ts-ignore
import bgVertShader from './shaders/bg-vert.glsl'
// @ts-ignore
import bgFragShader from './shaders/bg-frag.glsl'

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
    row: number
    col: number
    hlId: number
    charIdx: number
    isSecondHalfOfDoubleWidthCell: boolean
    leftAtlasBounds: number
    bottomAtlasBounds: number
  }) => void
  getBuffer: () => Float32Array
  updateGridId: (gridId: number) => void
  resetAtlasBounds: () => void
}

const createRenderer = () => {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    preserveDrawingBuffer: true,
  })
  if (!gl)
    throw new Error(
      "couldn't create webgl context . . . hmm, this shouldn't happen"
    )

  // TODO(smolck): This is apparently necessary to make the type-checking
  // GH action pass; it shouldn't be though?
  const gl2Asgl1becausewhyts = gl as WebGLRenderingContext

  twgl.addExtensionsToContext(gl2Asgl1becausewhyts)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

  const fgProgramInfo = twgl.createProgramInfo(gl2Asgl1becausewhyts, [
    fgVertShader,
    fgFragShader,
  ])
  const bgProgramInfo = twgl.createProgramInfo(gl2Asgl1becausewhyts, [
    bgVertShader,
    bgFragShader,
  ])

  const viewport = { x: 0, y: 0, width: 0, height: 0 }
  let shouldShowCursor = false
  let cursorShape = CursorShape.block

  gl.enable(gl.SCISSOR_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  const colorAtlas = getColorAtlas()
  const colorAtlasTex = twgl.createTexture(gl2Asgl1becausewhyts, { src: colorAtlas })

  const uniforms = {
    canvasResolution: [0, 0],
    fontAtlasResolution: [0, 0],
    colorAtlasResolution: [colorAtlas.width, colorAtlas.height],
    fontAtlasTextureId: 0,
    colorAtlasTextureId: colorAtlasTex,
    cellSize: [cell.width, cell.height],
    cellPadding: [0, cell.padding],

    hlidType: 0,

    shouldShowCursor: true,
    cursorPosition: [0, 0],
    cursorShape: 0,
    cursorColor: [0, 0, 0, 1],
    bgCursorColor: [1, 1, 1, 1],
  }

  // wait for roboto-mono to be loaded before we generate the initial font atlas
  ;(document as any).fonts.ready.then(() => {
    const fontAtlas = generateFontAtlas()
    const fontAtlasWidth = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const fontAtlasHeight = Math.floor(
      fontAtlas.height / window.devicePixelRatio
    )

    Object.assign(uniforms, {
      fontAtlasTextureId: twgl.createTexture(gl2Asgl1becausewhyts, { src: fontAtlas }),
      fontAtlasResolution: [fontAtlasWidth, fontAtlasHeight],
    })
  })

  const renderBuffer = gl.createBuffer()
  const quadBuffer = gl.createBuffer()
  const bgQuadBuffer = gl.createBuffer()
  if (!renderBuffer || !quadBuffer || !bgQuadBuffer)
    throw new Error("couldn't create buffers . . . hmm, this shouldn't happen")

  const stride = 7 * Float32Array.BYTES_PER_ELEMENT
  const bufferInfo: twgl.BufferInfo = {
    numElements: 0, // TODO(smolck)
    attribs: {
      cellPosition: {
        buffer: renderBuffer,
        size: 2,
        type: gl.FLOAT,
        offset: 0,
        stride,
        divisor: 1,
      },
      hlid: {
        buffer: renderBuffer,
        size: 1,
        type: gl.FLOAT,
        offset: 2 * Float32Array.BYTES_PER_ELEMENT,
        stride,
        divisor: 1,
      },
      isSecondHalfOfDoubleWidthCell: {
        buffer: renderBuffer,
        size: 1,
        type: gl.FLOAT,
        offset: 4 * Float32Array.BYTES_PER_ELEMENT,
        stride,
        divisor: 1,
      },
      atlasBounds: {
        buffer: renderBuffer,
        size: 2,
        type: gl.FLOAT,
        offset: 5 * Float32Array.BYTES_PER_ELEMENT,
        stride,
        divisor: 1,
      },
      quadVertex: {
        buffer: quadBuffer,
        type: gl.FLOAT,
        size: 2,
      },

      bgQuadVertex: {
        buffer: bgQuadBuffer,
        type: gl.FLOAT,
        size: 2,
      },
      isCursorTri: {
        buffer: bgQuadBuffer,
        type: gl.FLOAT,
        size: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 2 * 12,
      },
    },
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      0,
      0,
      cell.width,
      cell.height,
      0,
      cell.height,
      cell.width,
      0,
      cell.width,
      cell.height,
      0,
      0,
    ]),
    gl.STATIC_DRAW
  )

  const updateCellSize = (initial = false, cursorSize = 20) => {
    const w = cell.width
    const h = cell.height
    const smallerW = w * (cursorSize / 100.0)
    const percentH = h * (cursorSize / 100.0)

    const next = {
      boxes: new Float32Array([
        0,
        0,
        smallerW,
        h,
        0,
        h,

        smallerW,
        0,
        smallerW,
        h,
        0,
        0,

        smallerW,
        0,
        w,
        h,
        smallerW,
        h,

        w,
        0,
        w,
        h,
        smallerW,
        0,

        // TODO(smolck): Better way of doing this? Also, note that the 1's
        // specify which triangles of the above to color in for the cursor, and the zeroes
        // which triangles not to color in, *if* the cursor is a line shape. If
        // it isn't a line shape (atm a block shape), these are ignored.
        ...Array(6).fill(1),
        ...Array(6).fill(0),
      ]),
      // TODO(smolck): Don't draw double the tris for underliens too, maybe use
      // a separate buffer for quadVertex somehow or something?
      lines: new Float32Array([
        /* Previous values (for future ref):
         * 0, cell.height - 1,
         * cell.width, cell.height,
         * 0, cell.height,
         *
         * cell.width, cell.height - 1,
         * cell.width, cell.height,
         * 0, cell.height - 1, */
        0,
        h - 1,
        smallerW,
        percentH,
        0,
        percentH,

        smallerW,
        h - 1,
        smallerW,
        percentH,
        0,
        h - 1,

        smallerW,
        h - 1,
        w,
        percentH,
        smallerW,
        percentH,

        w,
        h - 1,
        w,
        percentH,
        smallerW,
        h - 1,

        ...Array(12).fill(0),
      ]),
    }

    uniforms.cellSize = [cell.width, cell.height]
    if (!initial) Object.assign(quads, next)

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0,
        0,
        cell.width,
        cell.height,
        0,
        cell.height,
        cell.width,
        0,
        cell.width,
        cell.height,
        0,
        0,
      ]),
      gl.STATIC_DRAW
    )

    Object.assign(uniforms, {
      cellSize: [cell.width, cell.height],
      cellPadding: [0, cell.padding],
    })
    return next
  }

  const quads = updateCellSize(true)

  const fgVertexArrayInfo = twgl.createVertexArrayInfo(
    gl2Asgl1becausewhyts,
    fgProgramInfo,
    bufferInfo
  )
  const bgVertexArrayInfo = twgl.createVertexArrayInfo(
    gl2Asgl1becausewhyts,
    bgProgramInfo,
    bufferInfo
  )

  const resize = (width: number, height: number) => {
    const w = Math.round(width * window.devicePixelRatio)
    const h = Math.round(height * window.devicePixelRatio)

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
  }

  const readjustViewportMaybe = (
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const bottom = (y + height) * window.devicePixelRatio
    const yy = Math.round(canvas.height - bottom)
    const xx = Math.round(x * window.devicePixelRatio)
    const ww = Math.round(width * window.devicePixelRatio)
    const hh = Math.round(height * window.devicePixelRatio)

    const same =
      viewport.width === ww &&
      viewport.height === hh &&
      viewport.x === xx &&
      viewport.y === yy

    if (same) return

    Object.assign(viewport, { x: xx, y: yy, width: ww, height: hh })
    gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)
    gl.scissor(viewport.x, viewport.y, viewport.width, viewport.height)
    Object.assign(uniforms, { canvasResolution: [width, height] })
  }

  const render = (
    buffer: Float32Array,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    readjustViewportMaybe(x, y, width, height)
    gl.bindBuffer(gl.ARRAY_BUFFER, renderBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW)

    const renderFg = () => {
      gl.useProgram(fgProgramInfo.program)
      gl.bindVertexArray(fgVertexArrayInfo.vertexArrayObject!!)
      twgl.setUniforms(fgProgramInfo, uniforms)
      twgl.drawBufferInfo(
        gl2Asgl1becausewhyts,
        bufferInfo,
        gl.TRIANGLES,
        6,
        0,
        buffer.length / 7
      )
    }

    const renderBg = () => {
      gl.useProgram(bgProgramInfo.program)
      gl.bindVertexArray(bgVertexArrayInfo.vertexArrayObject!!)
      // uniforms.cursorColor = uniforms.cursorColor.slice(0, 2).reverse()

      // background
      if (shouldShowCursor && cursorShape == 2)
        uniforms.shouldShowCursor = false
      uniforms.hlidType = 0
      twgl.setUniforms(bgProgramInfo, uniforms)
      gl.bindBuffer(gl.ARRAY_BUFFER, bgQuadBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, quads.boxes, gl.STATIC_DRAW)
      twgl.drawBufferInfo(
        gl2Asgl1becausewhyts,
        bufferInfo,
        gl.TRIANGLES,
        12,
        0,
        buffer.length / 7
      )

      // underlines
      uniforms.shouldShowCursor = shouldShowCursor
      gl.bindBuffer(gl.ARRAY_BUFFER, bgQuadBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, quads.lines, gl.STATIC_DRAW)

      // Just want to ignore the cursor logic in the vertex shader for underlines,
      // so set shouldShowCursor to false, then back to it's previous value after
      // the draw call.
      if (shouldShowCursor && cursorShape != CursorShape.underline)
        uniforms.shouldShowCursor = false
      uniforms.hlidType = 2
      twgl.setUniforms(bgProgramInfo, uniforms)
      twgl.drawBufferInfo(
        gl2Asgl1becausewhyts,
        bufferInfo,
        gl.TRIANGLES,
        12,
        0,
        buffer.length / 7
      )

      uniforms.shouldShowCursor = shouldShowCursor
    }

    renderBg()
    renderFg()
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    const width = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const height = Math.floor(fontAtlas.height / window.devicePixelRatio)
    Object.assign(uniforms, {
      fontAtlasResolution: [width, height],
      fontAtlasTextureId: twgl.createTexture(gl2Asgl1becausewhyts, {
        src: fontAtlas,
      }),
    })
  }

  const showCursor = (enable: boolean) => (
    (shouldShowCursor = enable), (uniforms.shouldShowCursor = enable)
  )

  const updateCursorColor = (color: [number, number, number]) => {
    const [r, g, b] = color
    uniforms.cursorColor = [1.0 - r, 1.0 - g, 1.0 - b, 1]
    uniforms.bgCursorColor = [r, g, b, 1]
  }

  const updateCursorShape = (shape: CursorShape) => {
    cursorShape = shape
    uniforms.cursorShape = shape
  }

  const updateCursorPosition = (row: number, col: number) => {
    uniforms.cursorPosition = [col, row]
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    uniforms.colorAtlasTextureId = twgl.createTexture(gl2Asgl1becausewhyts, {
      src: colorAtlas,
    })
    uniforms.colorAtlasResolution = [colorAtlas.width, colorAtlas.height]
  }

  const clear = (x: number, y: number, width: number, height: number) => {
    readjustViewportMaybe(x, y, width, height)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  const clearAll = () => {
    readjustViewportMaybe(0, 0, canvas.clientWidth, canvas.clientHeight)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  return {
    clear,
    clearAll,
    render,
    resize,
    updateFontAtlas,
    updateColorAtlas,
    updateCellSize,
    updateCursorPosition,
    updateCursorShape,
    updateCursorColor,
    showCursor,
    canvasElement: canvas,
  }
}

const nutella = () => {
  let fontAtlasCache: HTMLCanvasElement

  let renderer = createRenderer()

  const resizeCanvas = (width: number, height: number) => {
    renderer.resize(width, height)
  }

  const showCursor = (enable: boolean) => {
    renderer.showCursor(enable)
  }

  const updateCursorShape = (shape: CursorShape) => {
    renderer.updateCursorShape(shape)
    // TODO(smolck): If cursor size changes need to update cells . . .
    renderer.updateCellSize(false, cursorState.size)
  }

  const updateCursorColor = (r: number, g: number, b: number) => {
    renderer.updateCursorColor([r, g, b])
  }

  const updateCursorPosition = (row: number, col: number) => {
    renderer.updateCursorPosition(row, col)
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    renderer.updateFontAtlas(fontAtlas)
    fontAtlasCache = fontAtlas
  }

  const updateCellSize = () => {
    renderer.updateCellSize()
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    renderer.updateColorAtlas(colorAtlas)
  }

  const clearAll = () => {
    renderer.clearAll()
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
      renderer.render(buffer, x, y, width, height)
      if (doHacks) showCursor(true)
    }

    const renderGridBuffer = () => {
      const { x, y, width, height } = viewport
      const buffer = gridBuffer.getBuffer()

      const doHacks = gridId !== getActiveGridId() && cursorState.visible
      if (doHacks) showCursor(false)
      renderer.render(buffer, x, y, width, height)
      if (doHacks) showCursor(true)
    }

    const clear = () => {
      const { x, y, width, height } = viewport
      renderer.clear(x, y, width, height)
    }

    const clearGridBuffer = () => gridBuffer.clear()

    const moveRegionUp = (lines: number, top: number, bottom: number) => {
      gridBuffer.moveRegionUp(lines, top, bottom)
      const buffer = gridBuffer.getBuffer()
      const { x, y, width, height } = viewport
      renderer.render(buffer, x, y, width, height)
    }

    const moveRegionDown = (lines: number, top: number, bottom: number) => {
      gridBuffer.moveRegionDown(lines, top, bottom)
      const buffer = gridBuffer.getBuffer()
      const { x, y, width, height } = viewport
      renderer.render(buffer, x, y, width, height)
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
    canvasElement: renderer.canvasElement,
    reInit: () => {
      renderer = createRenderer()
      updateFontAtlas(fontAtlasCache)
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
