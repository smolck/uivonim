import { getColorAtlas } from '../highlight-attributes'
import generateFontAtlas from '../font-texture-atlas'
import { cell } from '../../workspace'
import { CursorShape } from '../../../common/types'
// @ts-ignore
import vertShader from './shaders/text-fg-vert.glsl'
// @ts-ignore
import fragShader from './shaders/text-fg-frag.glsl'
import * as twgl from 'twgl.js'

export default () => {
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  const gl = canvas.getContext('webgl2', { alpha: true, preserveDrawingBuffer: true }) as WebGL2RenderingContext
  twgl.addExtensionsToContext(gl)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

  const programInfo = twgl.createProgramInfo(gl, [vertShader, fragShader])
  const viewport = { x: 0, y: 0, width: 0, height: 0 }
 
  gl.useProgram(programInfo.program)
  gl.enable(gl.SCISSOR_TEST)

  const colorAtlas = getColorAtlas()
  const colorAtlasTex = twgl.createTexture(gl, { src: colorAtlas })

  const uniforms = {
    canvasResolution: [0, 0],
    fontAtlasResolution: [0, 0],
    colorAtlasResolution: [colorAtlas.width, colorAtlas.height],
    fontAtlasTextureId: 0,
    colorAtlasTextureId: colorAtlasTex,
    cellSize: [cell.width, cell.height],
    cellPadding: [0, cell.padding],

    shouldShowCursor: true,
    cursorPosition: [0, 0],
    cursorShape: 0,
    cursorColor: [0, 0, 0, 1],
  }

  // wait for roboto-mono to be loaded before we generate the initial font atlas
  ;(document as any).fonts.ready.then(() => {
    const fontAtlas = generateFontAtlas()
    const fontAtlasWidth = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const fontAtlasHeight = Math.floor(
      fontAtlas.height / window.devicePixelRatio
    )

    Object.assign(uniforms, { 
      fontAtlasTextureId: twgl.createTexture(gl, { src: fontAtlas }),
      fontAtlasResolution: [fontAtlasWidth, fontAtlasHeight ]
    })
  })

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
        size: 2
      }
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
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
  ]), gl.STATIC_DRAW)

  const vertexArrayInfo = twgl.createVertexArrayInfo(gl, programInfo, bufferInfo)
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
    const yy = Math.round(gl.canvas.height - bottom)
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
    gl.bindVertexArray(vertexArrayInfo.vertexArrayObject!!)
    twgl.setUniforms(programInfo, uniforms)
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES, 6, 0, buffer.length / 7)
    // webgl.gl.drawArraysInstanced()

    // webgl.gl.drawArraysInstanced(webgl.gl.TRIANGLES, 0, 6, buffer.length / 7)
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    const width = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const height = Math.floor(fontAtlas.height / window.devicePixelRatio)
    Object.assign(uniforms, {
      fontAtlasResolution: [width, height],
      fontAtlasTextureId: twgl.createTexture(gl, { src: fontAtlas })
    })
  }

  const updateCellSize = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
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
    ]), gl.STATIC_DRAW)

    Object.assign(uniforms, {
      cellSize: [cell.width, cell.height],
      cellPadding: [0, cell.padding]
    })
  }

  const showCursor = (enable: boolean) => (uniforms.shouldShowCursor = enable)

  const updateCursorColor = (color: [number, number, number]) => {
    uniforms.cursorColor = [...color, 1]
  }

  const updateCursorShape = (shape: CursorShape) => {
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
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  const clearAll = () => {
    readjustViewportMaybe(
      0,
      0,
      canvas.clientWidth,
      canvas.clientHeight
    )
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
