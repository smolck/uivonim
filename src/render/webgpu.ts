/// <reference types="@webgpu/types" />

export default async (canvas: HTMLCanvasElement) => {
  // @ts-ignore
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return

  const device = await adapter.requestDevice()
  if (!device) return

  const ctx = canvas.getContext('gpupresent')
  if (!ctx) return

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
      // { binding: 2, resource: TODO }
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
      // { binding: 4, resource: TODO }
      // cursor
      { binding: 5, resource: cursorBuffer },
    ],
  })

  const render = (buffer: Float32Array) => {
    // const commandEncoder
  }

  console.log(adapter, device, ctx)
}
