import { getColorAtlas } from '../highlight-attributes'
import generateFontAtlas from '../font-texture-atlas'
import { WebGL, VarKind } from './utils'
import { cell } from '../../workspace'
import { CursorShape } from '../../../common/types'

export default (webgl: WebGL) => {
  const viewport = { x: 0, y: 0, width: 0, height: 0 }

  const program = webgl.setupProgram({
    quadVertex: VarKind.Attribute,

    cellPosition: VarKind.Attribute,
    hlid: VarKind.Attribute,
    isDoubleWidth: VarKind.Attribute,
    atlasBounds: VarKind.Attribute,

    canvasResolution: VarKind.Uniform,
    fontAtlasResolution: VarKind.Uniform,
    colorAtlasResolution: VarKind.Uniform,
    fontAtlasTextureId: VarKind.Uniform,
    colorAtlasTextureId: VarKind.Uniform,
    cellSize: VarKind.Uniform,
    cellPadding: VarKind.Uniform,

    shouldShowCursor: VarKind.Uniform,
    cursorPosition: VarKind.Uniform,
    cursorShape: VarKind.Uniform,
    cursorColor: VarKind.Uniform,
  })

  program.setVertexShader(
    (v) => `#version 300 es
    in vec2 ${v.quadVertex};
    in vec2 ${v.cellPosition};
    in float ${v.hlid};
    in vec2 ${v.atlasBounds};
    in float ${v.isDoubleWidth};

    uniform vec2 ${v.canvasResolution};
    uniform vec2 ${v.fontAtlasResolution};
    uniform vec2 ${v.colorAtlasResolution};
    uniform vec2 ${v.cellSize};
    uniform vec2 ${v.cellPadding};
    uniform sampler2D ${v.colorAtlasTextureId};

    uniform vec4 ${v.cursorColor};
    uniform vec2 ${v.cursorPosition};
    uniform bool ${v.shouldShowCursor};
    uniform int ${v.cursorShape};

    out vec2 o_glyphPosition;
    out vec4 o_color;

    void main() {
      vec2 prevCellPos = vec2(${v.cellPosition}.x - 1.0, ${v.cellPosition}.y);
      bool tbdNameCondition = ${v.isDoubleWidth} == 1.0 && ${v.cursorPosition} == prevCellPos && ${v.cursorShape} == 0;
      bool isCursorCell = (tbdNameCondition || ${v.cursorPosition} == ${v.cellPosition}) && ${
        v.shouldShowCursor
      };

      vec2 absolutePixelPosition = ${v.cellPosition} * ${v.cellSize};
      vec2 vertexPosition = absolutePixelPosition + ${v.quadVertex} + ${v.cellPadding};
      vec2 posFloat = vertexPosition / ${v.canvasResolution};
      float posx = posFloat.x * 2.0 - 1.0;
      float posy = posFloat.y * -2.0 + 1.0;
      gl_Position = vec4(posx, posy, 0, 1);

      o_glyphPosition = (${v.atlasBounds} + ${v.quadVertex}) / ${v.fontAtlasResolution};

      float texelSize = 2.0;
      float color_x = ${v.hlid} * texelSize + 1.0;
      float color_y = 1.0 * texelSize + 1.0;
      vec2 colorPosition = vec2(color_x, color_y) / ${v.colorAtlasResolution};

      vec4 textureColor = texture(${v.colorAtlasTextureId}, colorPosition);

      if (isCursorCell && cursorShape == 0) {
        o_color = ${v.cursorColor};
      } else {
        o_color = textureColor;
      }
    }
  `
  )

  program.setFragmentShader(
    (v) => `#version 300 es
    precision mediump float;

    in vec2 o_glyphPosition;
    in vec4 o_color;
    uniform sampler2D ${v.fontAtlasTextureId};

    out vec4 outColor;

    void main() {
      vec4 glyphColor = texture(${v.fontAtlasTextureId}, o_glyphPosition);
      outColor = glyphColor * o_color;
    }
  `
  )

  program.create()
  program.use()

  // wait for roboto-mono to be loaded before we generate the initial font atlas
  ;(document as any).fonts.ready.then(() => {
    const fontAtlas = generateFontAtlas()
    const fontAtlasWidth = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const fontAtlasHeight = Math.floor(
      fontAtlas.height / window.devicePixelRatio
    )

    webgl.loadCanvasTexture(fontAtlas, webgl.gl.TEXTURE0)
    webgl.gl.uniform1i(program.vars.fontAtlasTextureId, 0)
    webgl.gl.uniform2f(
      program.vars.fontAtlasResolution,
      fontAtlasWidth,
      fontAtlasHeight
    )
  })

  const colorAtlas = getColorAtlas()
  webgl.loadCanvasTexture(colorAtlas, webgl.gl.TEXTURE1)
  webgl.gl.uniform1i(program.vars.colorAtlasTextureId, 1)
  webgl.gl.uniform2f(
    program.vars.colorAtlasResolution,
    colorAtlas.width,
    colorAtlas.height
  )

  webgl.gl.uniform4fv(program.vars.cursorColor, [0, 0, 0, 1])
  webgl.gl.uniform2f(program.vars.cursorPosition, 0, 0)
  webgl.gl.uniform1i(program.vars.cursorShape, 0) // CursorShape.block = 0
  webgl.gl.uniform1i(program.vars.shouldShowCursor, 1 /* true */)

  // total size of all pointers. chunk size that goes to shader
  const wrenderStride = 7 * Float32Array.BYTES_PER_ELEMENT
  console.log(program.vars.atlasBounds)
  console.log(program.vars.cellPosition)
  console.log(program.vars.hlid)

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
    {
      pointer: program.vars.isDoubleWidth,
      type: webgl.gl.FLOAT,
      size: 1,
      offset: 4 * Float32Array.BYTES_PER_ELEMENT,
      stride: wrenderStride,
      divisor: 1,
    },
    {
      pointer: program.vars.atlasBounds,
      type: webgl.gl.FLOAT,
      size: 2,
      offset: 5 * Float32Array.BYTES_PER_ELEMENT,
      stride: wrenderStride,
      divisor: 1,
    },
  ])

  const quadBuffer = program.setupData({
    pointer: program.vars.quadVertex,
    type: webgl.gl.FLOAT,
    size: 2,
  })

  quadBuffer.setData(
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
    ])
  )

  webgl.gl.uniform2f(program.vars.cellSize, cell.width, cell.height)
  webgl.gl.uniform2f(program.vars.cellPadding, 0, cell.padding)

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
    webgl.gl.drawArraysInstanced(webgl.gl.TRIANGLES, 0, 6, buffer.length / 7)
  }

  const updateFontAtlas = (fontAtlas: HTMLCanvasElement) => {
    webgl.loadCanvasTexture(fontAtlas, webgl.gl.TEXTURE0)
    const width = Math.floor(fontAtlas.width / window.devicePixelRatio)
    const height = Math.floor(fontAtlas.height / window.devicePixelRatio)
    webgl.gl.uniform2f(program.vars.fontAtlasResolution, width, height)
  }

  const updateCellSize = () => {
    quadBuffer.setData(
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
      ])
    )

    webgl.gl.uniform2f(program.vars.cellSize, cell.width, cell.height)
    webgl.gl.uniform2f(program.vars.cellPadding, 0, cell.padding)
  }

  const showCursor = (enable: boolean) => webgl.gl.uniform1i(program.vars.shouldShowCursor, enable ? 1 : 0)

  const updateCursorColor = (color: [number, number, number]) => {
    webgl.gl.uniform4fv(program.vars.cursorColor, [...color, 1])
  }

  const updateCursorShape = (shape: CursorShape) => {
    webgl.gl.uniform1i(program.vars.cursorShape, shape)
  }

  const updateCursorPosition = (row: number, col: number) => {
    webgl.gl.uniform2f(program.vars.cursorPosition, col, row)
  }

  const updateColorAtlas = (colorAtlas: HTMLCanvasElement) => {
    webgl.loadCanvasTexture(colorAtlas, webgl.gl.TEXTURE1)
    webgl.gl.uniform2f(
      program.vars.colorAtlasResolution,
      colorAtlas.width,
      colorAtlas.height
    )
  }

  const clear = (x: number, y: number, width: number, height: number) => {
    readjustViewportMaybe(x, y, width, height)
    webgl.gl.clear(webgl.gl.COLOR_BUFFER_BIT)
  }

  const clearAll = () => {
    readjustViewportMaybe(
      0,
      0,
      webgl.canvasElement.clientWidth,
      webgl.canvasElement.clientHeight
    )
    webgl.gl.clear(webgl.gl.COLOR_BUFFER_BIT)
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
  }
}
