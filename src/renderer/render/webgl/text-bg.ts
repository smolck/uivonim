import { getColorAtlas, colors } from '../highlight-attributes'
import { WebGL, VarKind } from './utils'
import { cell } from '../../workspace'
import { hexToRGB } from '../../ui/css'
import { CursorShape } from '../../cursor'

export default (webgl: WebGL) => {
  const viewport = { x: 0, y: 0, width: 0, height: 0 }
  let shouldShowCursor = true
  let cursorShape = 0 /* CursorShape.block */

  const program = webgl.setupProgram({
    quadVertex: VarKind.Attribute,
    isCursorTri: VarKind.Attribute,
    cellPosition: VarKind.Attribute,
    hlid: VarKind.Attribute,
    hlidType: VarKind.Uniform,
    canvasResolution: VarKind.Uniform,
    colorAtlasResolution: VarKind.Uniform,
    colorAtlasTextureId: VarKind.Uniform,
    cellSize: VarKind.Uniform,
    cursorPosition: VarKind.Uniform,
    cursorColor: VarKind.Uniform,
    cursorShape: VarKind.Uniform,
    shouldShowCursor: VarKind.Uniform,
  })

  program.setVertexShader(
    (v) => `#version 300 es
    in vec2 ${v.quadVertex};
    in vec2 ${v.cellPosition};
    in float ${v.isCursorTri};
    in float ${v.hlid};
    uniform vec2 ${v.cursorPosition};
    uniform vec2 ${v.canvasResolution};
    uniform vec2 ${v.colorAtlasResolution};
    uniform vec2 ${v.cellSize};
    uniform vec4 ${v.cursorColor};
    uniform bool ${v.shouldShowCursor};
    uniform int ${v.cursorShape};
    uniform float ${v.hlidType};
    uniform sampler2D ${v.colorAtlasTextureId};
    out vec4 o_color;
    out vec2 o_colorPosition;

    void main() {
      bool isCursorCell = ${v.cursorPosition} == ${v.cellPosition} && ${
        v.shouldShowCursor
      };

      vec2 absolutePixelPosition = ${v.cellPosition} * ${v.cellSize};
      vec2 vertexPosition = absolutePixelPosition + ${v.quadVertex};
      vec2 posFloat = vertexPosition / ${v.canvasResolution};
      float posx = posFloat.x * 2.0 - 1.0;
      float posy = posFloat.y * -2.0 + 1.0;
      gl_Position = vec4(posx, posy, 0, 1);

      float texelSize = 2.0;
      float color_x = ${v.hlid} * texelSize + 1.0;
      float color_y = ${v.hlidType} * texelSize + 1.0;
      vec2 colorPosition = vec2(color_x, color_y) / ${v.colorAtlasResolution};

      bool condition;
      ${
        /*
        TODO(smolck): I'm almost certain there's a way to do this
        condition all in one without extra if statements, but my brain is
        not finding it right now.
      */ ''
      }
      if (${v.cursorShape} == 1) {
        condition = isCursorCell && isCursorTri == 1.0;
      } else {
        condition = isCursorCell;
      }

      if (condition) {
        o_color = cursorColor;
      } else {
        vec4 textureColor = texture(${v.colorAtlasTextureId}, colorPosition);
        o_color = textureColor;
      }
    }
  `
  )

  program.setFragmentShader(
    () => `#version 300 es
    precision mediump float;

    in vec4 o_color;
    out vec4 outColor;

    void main() {
      outColor = o_color;
    }
  `
  )

  program.create()
  program.use()
  webgl.gl.enable(webgl.gl.BLEND)
  webgl.gl.blendFunc(webgl.gl.SRC_ALPHA, webgl.gl.ONE_MINUS_SRC_ALPHA)

  const colorAtlas = getColorAtlas()
  webgl.loadCanvasTexture(colorAtlas, webgl.gl.TEXTURE0)
  webgl.gl.uniform1i(program.vars.colorAtlasTextureId, 0)
  webgl.gl.uniform2f(
    program.vars.colorAtlasResolution,
    colorAtlas.width,
    colorAtlas.height
  )
  webgl.gl.uniform2f(program.vars.cursorPosition, 0, 0)
  webgl.gl.uniform4fv(program.vars.cursorColor, [1, 1, 1, 1])
  webgl.gl.uniform1i(program.vars.shouldShowCursor, shouldShowCursor ? 1 : 0)

  // total size of all pointers. chunk size that goes to shader
  const wrenderStride = 4 * Float32Array.BYTES_PER_ELEMENT

  const wrenderBuffer = program.setupData([
    {
      pointer: program.vars.cellPosition,
      type: webgl.gl.FLOAT,
      size: 2,
      offset: 0,
      stride: wrenderStride,
      divisor: 1,
    },
    {
      pointer: program.vars.hlid,
      type: webgl.gl.FLOAT,
      size: 1,
      offset: 2 * Float32Array.BYTES_PER_ELEMENT,
      stride: wrenderStride,
      divisor: 1,
    },
  ])

  const quadBuffer = program.setupData([
    {
      pointer: program.vars.quadVertex,
      type: webgl.gl.FLOAT,
      size: 2,
      offset: 0,
    },
    {
      pointer: program.vars.isCursorTri,
      type: webgl.gl.FLOAT,
      size: 1,
      offset: Float32Array.BYTES_PER_ELEMENT * 2 * 12,
    },
  ])

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

    webgl.gl.uniform2f(program.vars.cellSize, cell.width, cell.height)
    if (!initial) Object.assign(quads, next)
    return next
  }

  const quads = updateCellSize(true)

  const resize = (width: number, height: number) => {
    webgl.resize(width, height)
  }

  const readjustViewportMaybe = (
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const bottom = (y + height) * window.devicePixelRatio
    const yy = Math.round(webgl.canvasElement.height - bottom)
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
    webgl.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)
    webgl.gl.scissor(viewport.x, viewport.y, viewport.width, viewport.height)
    webgl.gl.uniform2f(program.vars.canvasResolution, width, height)
  }

  const render = (
    buffer: Float32Array,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    readjustViewportMaybe(x, y, width, height)
    wrenderBuffer.setData(buffer)

    if (shouldShowCursor && cursorShape == 2)
      webgl.gl.uniform1i(program.vars.shouldShowCursor, 0 /* false */)
    // background
    quadBuffer.setData(quads.boxes)
    webgl.gl.uniform1f(program.vars.hlidType, 0)
    webgl.gl.drawArraysInstanced(webgl.gl.TRIANGLES, 0, 12, buffer.length / 4)

    webgl.gl.uniform1i(program.vars.shouldShowCursor, shouldShowCursor ? 1 : 0)

    // underlines
    quadBuffer.setData(quads.lines)

    // Just want to ignore the cursor logic in the vertex shader for underlines,
    // so set shouldShowCursor to false, then back to it's previous value after
    // the draw call.
    if (shouldShowCursor && cursorShape != 2 /* CursorShape.underline */)
      webgl.gl.uniform1i(program.vars.shouldShowCursor, 0 /* false */)

    webgl.gl.uniform1f(program.vars.hlidType, 2)
    webgl.gl.drawArraysInstanced(webgl.gl.TRIANGLES, 0, 12, buffer.length / 4)

    webgl.gl.uniform1i(program.vars.shouldShowCursor, shouldShowCursor ? 1 : 0)
  }

  const showCursor = (enable: boolean) => (
    shouldShowCursor = enable,
    webgl.gl.uniform1i(program.vars.shouldShowCursor, enable ? 1 : 0)
  )

  const updateCursorColor = (color: [number, number, number]) => {
    webgl.gl.uniform4fv(program.vars.cursorColor, [...color, 1])
  }

  const updateCursorShape = (shape: CursorShape) => {
    cursorShape = shape
    webgl.gl.uniform1i(program.vars.cursorShape, shape)
  }

  const updateCursorPosition = (row: number, col: number) => {
    webgl.gl.uniform2f(program.vars.cursorPosition, col, row)
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    webgl.loadCanvasTexture(colorAtlas, webgl.gl.TEXTURE0)
    webgl.gl.uniform2f(
      program.vars.colorAtlasResolution,
      colorAtlas.width,
      colorAtlas.height
    )
  }

  const clear = (x: number, y: number, width: number, height: number) => {
    readjustViewportMaybe(x, y, width, height)
    const [r, g, b] = hexToRGB(colors.background)
    webgl.gl.clearColor(r / 255, g / 255, b / 255, 1)
    webgl.gl.clear(webgl.gl.COLOR_BUFFER_BIT)
  }

  const clearAll = () => {
    readjustViewportMaybe(
      0,
      0,
      webgl.canvasElement.width,
      webgl.canvasElement.height
    )
    const [r, g, b] = hexToRGB(colors.background)
    webgl.gl.clearColor(r / 255, g / 255, b / 255, 1)
    webgl.gl.clear(webgl.gl.COLOR_BUFFER_BIT)
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
  }
}
