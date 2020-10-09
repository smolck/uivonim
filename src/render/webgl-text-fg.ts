import { getColorAtlas } from '../render/highlight-attributes'
import generateFontAtlas from '../render/font-texture-atlas'
import { WebGL, VarKind } from '../render/webgl-utils'
import { cell } from '../core/workspace'
import { Regl, Texture2D, Buffer } from 'regl'

type ReglRenderProps = {
  buffer: Buffer
  quadVertex: number[]
  instances: number

  // Uniforms
  cellSize: number[]
  cellPadding: number[]
  canvasResolution: [number, number]
  fontAtlasTexture: Texture2D
  fontAtlasResolution: [number, number]
  colorAtlasResolution: [number, number]
  colorAtlasTexture: Texture2D

  // Viewport
  vpX: number
  vpY: number
  vpWidth: number
  vpHeight: number

  // Scissor
  sciX: number
  sciY: number
  sciWidth: number
  sciHeight: number
}

export default (regl: Regl, canvas: HTMLCanvasElement) => {
  // total size of all pointers. chunk size that goes to shader
  const wrenderStride = 4 * Float32Array.BYTES_PER_ELEMENT

  const viewport = { x: 0, y: 0, width: 0, height: 0 }

  const reglRender = regl({
    vert:`
      attribute vec2 quadVertex;
      attribute vec2 cellPosition;
      attribute float hlid;
      attribute float charIndex;
      uniform vec2 canvasResolution;
      uniform vec2 fontAtlasResolution;
      uniform vec2 colorAtlasResolution;
      uniform vec2 cellSize;
      uniform vec2 cellPadding;
      uniform sampler2D colorAtlasTexture;

      varying vec2 o_glyphPosition;
      varying vec4 o_color;

      void main() {
        vec2 absolutePixelPosition = cellPosition * cellSize;
        vec2 vertexPosition = absolutePixelPosition + quadVertex + cellPadding;
        vec2 posFloat = vertexPosition / canvasResolution;
        float posx = posFloat.x * 2.0 - 1.0;
        float posy = posFloat.y * -2.0 + 1.0;
        gl_Position = vec4(posx, posy, 0, 1);

        vec2 glyphPixelPosition = vec2(charIndex, 0) * cellSize;
        vec2 glyphVertex = glyphPixelPosition + quadVertex;
        o_glyphPosition = glyphVertex / fontAtlasResolution;

        float texelSize = 2.0;
        float color_x = hlid * texelSize + 1.0;
        float color_y = 1.0 * texelSize + 1.0;
        vec2 colorPosition = vec2(color_x, color_y) / colorAtlasResolution;

        o_color = texture2D(colorAtlasTexture, colorPosition);
      }
    `,
        frag:`
      precision mediump float;

      varying vec2 o_glyphPosition;
      varying vec4 o_color;
      uniform sampler2D fontAtlasTexture;

      void main() {
       vec4 glyphColor = texture2D(fontAtlasTexture, o_glyphPosition);
       gl_FragColor = glyphColor * o_color;
      }
    `,

    scissor: {
      enable: true,
      box: {
        // @ts-ignore
        x: regl.prop('sciX'),
        // @ts-ignore
        y: regl.prop('sciY'),
        // @ts-ignore
        width: regl.prop('sciWidth'),
        // @ts-ignore
        height: regl.prop('sciHeight'),
      }
    },

    viewport: {
      // @ts-ignore
      x: regl.prop('vpX'),
      // @ts-ignore
      y: regl.prop('vpY'),
      // @ts-ignore
      width: regl.prop('vpWidth'),
      // @ts-ignore
      height: regl.prop('vpHeight'),
    },

    attributes: {
      quadVertex: (_ctx, props) => ({
        type: 'float',
        size: 2,
        buffer: props.quadVertex
      }),
      cellPosition: (_ctx, props) => ({
        buffer: props.buffer,
        type: 'float',
        size: 2,
        offset: 0,
        stride: wrenderStride,
        // TODO(smolck): Need to enable "instancing" for this to be used?
        divisor: 1,
      }),
      hlid: (_ctx, props) => ({
        buffer: props.buffer,
        type: 'float',
        size: 1,
        offset: 2 * Float32Array.BYTES_PER_ELEMENT,
        stride: wrenderStride,
        divisor: 1,
      }),
      charIndex: (_ctx, props) => ({
        buffer: props.buffer,
        type: 'float',
        size: 1,
        offset: 3 * Float32Array.BYTES_PER_ELEMENT,
        stride: wrenderStride,
        divisor: 1,
      })
    },

    uniforms: {
      // Vertex shader:
      //    canvasResolution
      //    fontAtlasResolution
      //    colorAtlasResolution
      //    cellSize
      //    cellPadding
      //    colorAtlasTextureId

      // @ts-ignore
      cellSize: regl.prop('cellSize'),
      // @ts-ignore
      cellPadding: regl.prop('cellPadding'),
      // @ts-ignore
      canvasResolution: regl.prop('canvasResolution'),
      // @ts-ignore
      fontAtlasResolution: regl.prop('fontAtlasResolution'),
      // @ts-ignore
      colorAtlasResolution: regl.prop('colorAtlasResolution'),
      // @ts-ignore
      colorAtlasTexture: regl.prop('colorAtlasTexture'),

      // @ts-ignore
      fontAtlasTexture: regl.prop('fontAtlasTexture'),
    },

    primitive: 'triangles',
    offset: 0,
    count: 6,
    instances: (_ctx, props, _batchId) => props.instances
  })

  // TODO(smolck): Is this a good default?
  let canvasResolution = [viewport.width, viewport.height]

  let fontAtlasTexture: Texture2D | null
  // [width, height]
  let fontAtlasResolution: [number, number] | null

  let cellSize: number[] = [cell.width, cell.height]
  let cellPadding: number[] = [0, cell.padding]

  let quadBuffer = [
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
  ]

  const createTexture = (data: HTMLCanvasElement, width: number, height: number) => regl.texture({
    premultiplyAlpha: true,
    min: 'nearest',
    mag: 'nearest',
    wrapS: 'clamp',
    wrapT: 'clamp',
    format: 'rgba',
    type: 'uint8',
    shape: [width, height, 4],
    data,
  })

  // wait for roboto-mono to be loaded before we generate the initial font atlas
  ;(document as any).fonts.ready.then(() => {
    const fontAtlas = generateFontAtlas()
    const fontAtlasWidth = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const fontAtlasHeight = Math.floor(
      fontAtlas.height / window.devicePixelRatio
    )

    fontAtlasTexture = createTexture(fontAtlas, fontAtlasWidth, fontAtlasHeight)

    fontAtlasResolution = [fontAtlasWidth, fontAtlasHeight]
  })

  const initialColorAtlas = getColorAtlas()
  let colorAtlasTexture = createTexture(initialColorAtlas, initialColorAtlas.width, initialColorAtlas.height)
  // [width, height]
  let colorAtlasResolution = [initialColorAtlas.width, initialColorAtlas.height]

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
    canvasResolution = [viewport.width, viewport.height]
  }

  const render = (
    buffer: Float32Array,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    readjustViewportMaybe(x, y, width, height)
    const sciX = viewport.x
    const sciY = viewport.y
    const sciWidth = viewport.width
    const sciHeight = viewport.height

    reglRender({
      buffer: regl.buffer({
        data: buffer,
        usage: 'static',
      }),
      quadVertex: quadBuffer,
      instances: buffer.length / 4,
      vpX: sciX,
      vpY: sciY,
      vpHeight: sciHeight,
      vpWidth: sciWidth,
      canvasResolution,
      fontAtlasResolution,
      fontAtlasTexture,
      colorAtlasResolution,
      colorAtlasTexture,
      cellSize,
      cellPadding,
      sciX,
      sciY,
      sciWidth,
      sciHeight
    } as ReglRenderProps)
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    fontAtlasTexture = createTexture(fontAtlas, fontAtlas.width, fontAtlas.height)
    const width = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const height = Math.floor(fontAtlas.height / window.devicePixelRatio)
    fontAtlasResolution = [width, height]
  }

  const updateCellSize = () => {
    quadBuffer = ([
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
    ])

    cellSize = [cell.width, cell.height]
    cellPadding = [0, cell.padding]
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    colorAtlasTexture = createTexture(colorAtlas, colorAtlas.width, colorAtlas.height)
    colorAtlasResolution = [colorAtlas.width, colorAtlas.height]
  }

  const clear = (x: number, y: number, width: number, height: number) => {
    readjustViewportMaybe(x, y, width, height)
    regl.clear({ depth: 1, color: [0, 0, 0, 0] })
  }

  const clearAll = () => {
    readjustViewportMaybe(
      0,
      0,
      canvas.clientWidth,
      canvas.clientHeight
    )
    regl.clear({ depth: 1, color: [0, 0, 0, 0] })
  }

  return {
    clear,
    clearAll,
    render,
    resize,
    updateFontAtlas,
    updateColorAtlas,
    updateCellSize,
  }
}
