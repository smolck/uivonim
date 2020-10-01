import { getColorAtlas } from '../render/highlight-attributes'
import generateFontAtlas from '../render/font-texture-atlas'
import { WebGL, VarKind } from '../render/webgl-utils'
import { cell } from '../core/workspace'

export default (webgl: WebGL) => {
  const viewport = { x: 0, y: 0, width: 0, height: 0 }

  const w2 = webgl.webgl2Mode
  const c = {
    attr: w2 ? 'in' : 'attribute',
    out: w2 ? 'out' : 'varying',
    tex: w2 ? 'texture' : 'texture2D',
    fin: w2 ? 'in' : 'varying',
  }

  const program = webgl.setupProgram({
    quadVertex: VarKind.Attribute,
    charIndex: VarKind.Attribute,
    cellPosition: VarKind.Attribute,
    hlid: VarKind.Attribute,
    canvasResolution: VarKind.Uniform,
    fontAtlasResolution: VarKind.Uniform,
    colorAtlasResolution: VarKind.Uniform,
    fontAtlasTextureId: VarKind.Uniform,
    colorAtlasTextureId: VarKind.Uniform,
    cellSize: VarKind.Uniform,
    cellPadding: VarKind.Uniform,
  })

  program.setVertexShader(
    (v) => `
    ${c.attr} vec2 ${v.quadVertex};
    ${c.attr} vec2 ${v.cellPosition};
    ${c.attr} float ${v.hlid};
    ${c.attr} float ${v.charIndex};
    uniform vec2 ${v.canvasResolution};
    uniform vec2 ${v.fontAtlasResolution};
    uniform vec2 ${v.colorAtlasResolution};
    uniform vec2 ${v.cellSize};
    uniform vec2 ${v.cellPadding};
    uniform sampler2D ${v.colorAtlasTextureId};

    ${c.out} vec2 o_glyphPosition;
    ${c.out} vec4 o_color;

    void main() {
      vec2 absolutePixelPosition = ${v.cellPosition} * ${v.cellSize};
      vec2 vertexPosition = absolutePixelPosition + ${v.quadVertex} + ${v.cellPadding};
      vec2 posFloat = vertexPosition / ${v.canvasResolution};
      float posx = posFloat.x * 2.0 - 1.0;
      float posy = posFloat.y * -2.0 + 1.0;
      gl_Position = vec4(posx, posy, 0, 1);

      vec2 glyphPixelPosition = vec2(${v.charIndex}, 0) * ${v.cellSize};
      vec2 glyphVertex = glyphPixelPosition + ${v.quadVertex};
      o_glyphPosition = glyphVertex / ${v.fontAtlasResolution};

      vec2 colorPosition = vec2(${v.hlid} + 0.0001, 1.0001) / ${v.colorAtlasResolution};
      o_color = ${c.tex}(${v.colorAtlasTextureId}, colorPosition);
    }
  `
  )

  program.setFragmentShader(
    (v) => `
    precision mediump float;

    ${c.fin} vec2 o_glyphPosition;
    ${c.fin} vec4 o_color;
    uniform sampler2D ${v.fontAtlasTextureId};

    ${w2 ? 'out vec4 outColor;' : ''}

    void main() {
      vec4 glyphColor = ${c.tex}(${v.fontAtlasTextureId}, o_glyphPosition);
      ${w2 ? 'outColor' : 'gl_FragColor'} = glyphColor * o_color;
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
    {
      pointer: program.vars.charIndex,
      type: webgl.gl.FLOAT,
      size: 1,
      offset: 3 * Float32Array.BYTES_PER_ELEMENT,
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
    webgl.drawArraysInstanced(webgl.gl.TRIANGLES, 0, 6, buffer.length / 4)
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
  }
}
