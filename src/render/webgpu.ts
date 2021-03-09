/// <reference types="@webgpu/types" />
import { getColorAtlas, getColorAtlasImageData } from './highlight-attributes'
import generateFontAtlas, { getFontAtlasImageData } from './font-texture-atlas'
import { cell } from '../core/workspace'
import { CursorShape } from '../core/cursor'

export default async (canvas: HTMLCanvasElement) => {
  if (!navigator.gpu) return
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return

  const device = await adapter.requestDevice()
  if (!device) return

  const ctx = canvas.getContext('gpupresent')
  if (!ctx) return

  const viewport = { x: 0, y: 0, width: 0, height: 0 }
  // TODO(smolck): Use object for state (specifically cursor state) probably?
  let canvasRes = [0, 0]
  let cursorPos = [0, 0]
  let cursorShape = CursorShape.block
  let cursorColor = [0, 0, 0, 1]

  const swapChainFormat = await ctx.getSwapChainPreferredFormat(device)
  const swapChain = ctx.configureSwapChain({
    device,
    format: swapChainFormat,
  })

  const renderBufferStride = 4 * Float32Array.BYTES_PER_ELEMENT

  const foregroundPipeline = device.createRenderPipeline({
    vertexStage: {
      module: device.createShaderModule({
        code: `
        [[location(0)]] var<in> quadVertex : vec2<f32>;

        [[location(1)]] var<in> cellPosition : vec2<f32>;
        [[location(2)]] var<in> hlId : f32;
        [[location(3)]] var<in> charIndex : f32;

        [[block]] struct Uniforms {
          canvasResolution : vec2<f32>;
          fontAtlasResolution : vec2<f32>;
          colorAtlasResolution : vec2<f32>;
          cellSize : vec2<f32>;
          cellPadding : vec2<f32>;
        }
        [[binding(0), group(0)]] var<uniform> uniforms : Uniforms;

        [[binding(1), group(0)]] var<uniform> colorAtlasSampler : sampler;
        [[binding(2), group(0)]] var<uniform> colorAtlasTexture : texture2D;

        [[binding(3), group(0)]] var<uniform> fontAtlasSampler : sampler;
        [[binding(4), group(0)]] var<uniform> fontAtlasTexture : texture2D;

        [[block]] struct CursorUniforms {
          visible : bool;
          position : vec2<f32>;
          shape : i32;
          color : vec4<f32>;
        }
        [[binding(5), group(0)]] var<uniform> cursor : CursorUniforms;

        [[builtin(position)]] var<out> Position : vec4<f32>;

        [[stage(vertex)]]
        fn main() -> void {}
        `,
      }),
      entryPoint: 'main',
    },
    fragmentStage: {
      module: device.createShaderModule({
        code: `
        `,
      }),
      entryPoint: 'main',
    },
    // TODO(smolck)
    primitiveTopology: 'triangle-list',
    colorStates: [
      {
        format: swapChainFormat,
      },
    ],
    vertexState: {
      vertexBuffers: [
        // Render buffer (cells)
        {
          arrayStride: renderBufferStride,
          stepMode: 'vertex',
          attributes: [
            // cellPosition
            { shaderLocation: 1, offset: 0, format: 'float32x2' },
            // hlId
            {
              shaderLocation: 2,
              offset: 2 * Float32Array.BYTES_PER_ELEMENT,
              format: 'float32',
            },
            // charIndex
            {
              shaderLocation: 3,
              offset: 3 * Float32Array.BYTES_PER_ELEMENT,
              format: 'float32',
            },
          ],
        },
        // Quad Buffer
        {
          arrayStride: 0,
          // TODO(smolck): ?
          stepMode: 'vertex',
          attributes: [
            {
              // quadVertex
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2',
            },
          ],
        },
      ],
    },
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        device.createBindGroupLayout({
          entries: [
            // uniforms
            {
              binding: 0,
              // TODO(smolck)
              visibility: GPUShaderStage.VERTEX,
              type: 'uniform-buffer',
              // TODO(smolck): minBufferBindingSize = ?
            },
            // colorAtlasSampler
            { binding: 1, visibility: GPUShaderStage.VERTEX, type: 'sampler' },
            // colorAtlasTexture
            {
              binding: 2,
              visibility: GPUShaderStage.VERTEX,
              type: 'sampled-texture',
            },
            // fontAtlasSampler
            { binding: 3, visibility: GPUShaderStage.VERTEX, type: 'sampler' },
            // fontAtlasTexture
            {
              binding: 4,
              visibility: GPUShaderStage.VERTEX,
              type: 'sampled-texture',
            },
            // cursor
            {
              binding: 5,
              visibility: GPUShaderStage.VERTEX,
              type: 'uniform-buffer',
            },
          ],
        }),
      ],
    }),
  })

  const uniformBuffer = device.createBuffer({
    // 5 vec2<f32>'s
    size: 5 * 2 * 4,
    // TODO(smolck)
    usage: GPUBufferUsage.UNIFORM,
  })

  const cursorBuffer = device.createBuffer({
    size:
      4 /* shape : i32 */ +
      2 * 4 /* position : vec2<f32> */ +
      4 * 4 /* color : vec4<f32> */ +
      4 /* visible: bool - is this size correct?*/,
    // TODO(smolck)
    usage: GPUBufferUsage.UNIFORM,
  })

  const colorAtlas = getColorAtlas()
  const colorAtlasTexture = device.createTexture({
    // TODO(smolck): What is this 1 for?
    size: [colorAtlas.width, colorAtlas.height, 1],
    // TODO(smolck): What format to use?
    format: 'rgba8unorm',
    // TODO(smolck)
    usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.COPY_DST,
  })
  const colorAtlasImageBitmap = await createImageBitmap(
    getColorAtlasImageData()
  )
  device.queue.copyImageBitmapToTexture(
    {
      imageBitmap: colorAtlasImageBitmap,
    },
    { texture: colorAtlasTexture },
    [
      // TODO(smolck): What's the 1 for?
      colorAtlasImageBitmap.width,
      colorAtlasImageBitmap.height,
      1,
    ]
  )

  await (document as any).fonts.ready
  // TODO(smolck): Need to add way to update font atlas texture and such, same
  // is probably true for color atlas above
  const fontAtlas = generateFontAtlas()
  const fontAtlasImageBitmap = await createImageBitmap(getFontAtlasImageData())

  const fontAtlasWidth = Math.floor(fontAtlas.width / window.devicePixelRatio)
  const fontAtlasHeight = Math.floor(fontAtlas.height / window.devicePixelRatio)

  const fontAtlasTexture = device.createTexture({
    // TODO(smolck): What is this 1 for?
    size: [fontAtlas.width, fontAtlas.height],
    // TODO(smolck): What format to use?
    format: 'rgba8unorm',
    // TODO(smolck)
    usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.COPY_DST,
  })
  device.queue.copyImageBitmapToTexture(
    {
      imageBitmap: fontAtlasImageBitmap,
    },
    { texture: fontAtlasTexture },
    [
      // TODO(smolck): What's the 1 for?
      fontAtlasImageBitmap.width,
      fontAtlasImageBitmap.height,
      1,
    ]
  )

  const bindGroup = device.createBindGroup({
    layout: foregroundPipeline.getBindGroupLayout(0),
    entries: [
      // canvasResolution, fontAtlasResolution, colorAtlasResolution,
      // cellSize, cellPadding - all vec2<f32>'s
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
      // colorAtlasSampler
      {
        binding: 1,
        resource: device.createSampler({
          minFilter: 'nearest',
          magFilter: 'nearest',
        }),
      },
      // colorAtlasTexture
      { binding: 2, resource: colorAtlasTexture },
      // fontAtlasSampler
      // TODO(smolck): See if a new one needs to be created
      // or if the same one for the colorAtlas can be used here too
      {
        binding: 3,
        resource: device.createSampler({
          minFilter: 'nearest',
          magFilter: 'nearest',
        }),
      },
      // fontAtlasTexture
      { binding: 4, resource: fontAtlasTexture },
      // cursor
      { binding: 5, resource: cursorBuffer },
    ] as Iterable<GPUBindGroupEntry>, // TODO(smolck)
  })

  const textureView = swapChain.getCurrentTexture().createView()
  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        attachment: textureView,
        loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  }

  const quads = new Float32Array([
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
  const quadBuffer = device.createBuffer({
    size: quads.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  })
  new Float32Array(quadBuffer.getMappedRange()).set(quads)
  quadBuffer.unmap()

  const render = (buffer: Float32Array) => {
    new Float32Array(uniformBuffer.getMappedRange()).set([
      // canvasResolution
      canvasRes[0],
      canvasRes[1],
      // fontAtlasResolution
      fontAtlasWidth,
      fontAtlasHeight,
      // colorAtlasResolution
      colorAtlas.width,
      colorAtlas.height,
      // cellSize
      cell.width,
      cell.height,
      // cellPadding
      0,
      cell.padding,
    ])
    uniformBuffer.unmap()

    new Float32Array(cursorBuffer.getMappedRange()).set([
      // cursor visible
      // @ts-ignore TODO(smolck)
      true,
      // cursor position
      cursorPos[0],
      cursorPos[1],
      // cursor shape
      cursorShape,
      // cursor color,
      ...cursorColor,
    ])
    cursorBuffer.unmap()

    // TODO(smolck): Create every frame?
    const attributeBuffer = device.createBuffer({
      size: buffer.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    })
    new Float32Array(attributeBuffer.getMappedRange()).set(buffer)
    attributeBuffer.unmap()

    // @ts-ignore TODO(smolck)
    renderPassDescriptor.colorAttachments[0].attachment = swapChain
      .getCurrentTexture()
      .createView()

    const commandEncoder = device.createCommandEncoder()
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    // TODO(smolck): Last two params are minDepth and maxDepth of viewport, what
    // to use there? 0 and 1 as is done now or something else?
    //
    // Also, should be roughly equivalent to the following I think?
    // webgl.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)
    // webgl.gl.scissor(viewport.x, viewport.y, viewport.width, viewport.height)
    passEncoder.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, 0, 1)
    passEncoder.setScissorRect(viewport.x, viewport.y, viewport.width, viewport.height)

    passEncoder.setPipeline(foregroundPipeline)

    // TODO(smolck): Verify the first param to `setVertexBuffer`, `slot`, does
    // what I think it does.
    passEncoder.setVertexBuffer(0, attributeBuffer)
    passEncoder.setVertexBuffer(1, quadBuffer)
    passEncoder.setBindGroup(0, bindGroup)
    passEncoder.draw(6, buffer.length / 4)
    passEncoder.endPass()
    device.queue.submit([commandEncoder.finish()])
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
    canvasRes = [width, height]
  }

  const updateCursorPosition = (row: number, col: number) => {
    cursorPos = [col, row]
  }

  const updateCursorShape = (shape: CursorShape) => {
    cursorShape = shape
  }

  const updateCursorColor = (color: [number, number, number]) => {
    cursorColor = [...color, 1]
  }

  const updateCellSize = () => {
    new Float32Array(quadBuffer.getMappedRange()).set([
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
    quadBuffer.unmap()

    // TODO(smolck): Currently, the cellSize and cellPadding aren't stored in
    // state, just assigned every time from `cell` in `render`; should they be?
    // webgl.gl.uniform2f(program.vars.cellSize, cell.width, cell.height)
    // webgl.gl.uniform2f(program.vars.cellPadding, 0, cell.padding)
  }

  return {
    render,
    readjustViewportMaybe,
    updateCursorPosition,
    updateCursorShape,
    updateCursorColor,
    updateCellSize,
  }
}
