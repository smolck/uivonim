import { getColorAtlas, colors } from '../highlight-attributes'
import { cell } from '../../workspace'
import { hexToRGB } from '../../ui/css'
import { CursorShape } from '../../../common/types'
// @ts-ignore
import vertShader from './shaders/text-bg-vert.glsl'
// @ts-ignore
import fragShader from './shaders/text-bg-frag.glsl'
import * as twgl from 'twgl.js'

export default () => {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  const gl = canvas.getContext('webgl2', { alpha: true, preserveDrawingBuffer: true }) as WebGL2RenderingContext
  twgl.addExtensionsToContext(gl)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

  const programInfo = twgl.createProgramInfo(gl, [vertShader, fragShader])
  const viewport = { x: 0, y: 0, width: 0, height: 0 }
  let shouldShowCursor = true
  let cursorShape = 0 /* CursorShape.block */

  gl.useProgram(programInfo.program)
  gl.enable(gl.SCISSOR_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  const colorAtlas = getColorAtlas()
  const colorAtlasTex = twgl.createTexture(gl, { src: colorAtlas })

  const uniforms = {
    hlidType: 0,
    canvasResolution: [0, 0],
    colorAtlasResolution: [colorAtlas.width, colorAtlas.height],
    colorAtlasTextureId: colorAtlasTex,
    cellSize: [cell.width, cell.height],

    shouldShowCursor,
    cursorPosition: [0, 0],
    cursorShape: 0,
    cursorColor: [1, 1, 1, 1],
  }

  const renderBuffer = gl.createBuffer()
  const quadBuffer = gl.createBuffer()
  if (!renderBuffer || !quadBuffer) throw new Error("umm . . .") // TODO(smolck)

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

      quadVertex: {
        buffer: quadBuffer,
        type: gl.FLOAT,
        size: 2,
        offset: 0,
      },
      isCursorTri: {
        buffer: quadBuffer,
        type: gl.FLOAT,
        size: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 2 * 12,
      },
    }
  }

  const vertexArrayInfo = twgl.createVertexArrayInfo(gl, programInfo, bufferInfo)

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
    return next
  }

  const quads = updateCellSize(true)

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
    uniforms.canvasResolution = [width, height]
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
    gl.bindVertexArray(vertexArrayInfo.vertexArrayObject!!)

    // background
    if (shouldShowCursor && cursorShape == 2) uniforms.shouldShowCursor = false
    uniforms.hlidType = 0
    twgl.setUniforms(programInfo, uniforms)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, quads.boxes, gl.STATIC_DRAW)
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES, 12, 0, buffer.length / 7)

    // underlines
    uniforms.shouldShowCursor = shouldShowCursor
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, quads.lines, gl.STATIC_DRAW)

    // Just want to ignore the cursor logic in the vertex shader for underlines,
    // so set shouldShowCursor to false, then back to it's previous value after
    // the draw call.
    if (shouldShowCursor && cursorShape != CursorShape.underline)
      uniforms.shouldShowCursor = false
    uniforms.hlidType = 2
    twgl.setUniforms(programInfo, uniforms)
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES, 12, 0, buffer.length / 7)

    uniforms.shouldShowCursor = shouldShowCursor
  }

  const showCursor = (enable: boolean) => (
    (shouldShowCursor = enable), (uniforms.shouldShowCursor = enable)
  )

  const updateCursorColor = (color: [number, number, number]) => {
    uniforms.cursorColor = [...color, 1]
  }

  const updateCursorShape = (shape: CursorShape) => {
    cursorShape = shape
    uniforms.cursorShape = shape
  }

  const updateCursorPosition = (row: number, col: number) => {
    uniforms.cursorPosition = [col, row]
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    uniforms.colorAtlasTextureId = twgl.createTexture(gl, { src: colorAtlas })
    uniforms.colorAtlasResolution = [colorAtlas.width, colorAtlas.height]
  }

  const clear = (x: number, y: number, width: number, height: number) => {
    readjustViewportMaybe(x, y, width, height)
    const [r, g, b] = hexToRGB(colors.background)
    gl.clearColor(r / 255, g / 255, b / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  const clearAll = () => {
    readjustViewportMaybe(
      0,
      0,
      canvas.width,
      canvas.height
    )
    const [r, g, b] = hexToRGB(colors.background)
    gl.clearColor(r / 255, g / 255, b / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  return {
    clear,
    clearAll,
    render,
    resize,
    updateColorAtlas,
    updateCellSize,
    showCursor,
    updateCursorPosition,
    updateCursorShape,
    updateCursorColor,
    canvasElement: canvas,
  }
}
